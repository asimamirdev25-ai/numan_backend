const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const withTransaction = require('../utils/withTransaction');
const { nextOrderNumber } = require('../utils/orderNumbers');
const { getPagination, buildMeta } = require('../utils/pagination');
const { resolveDateRange } = require('../utils/dateRange');
const { formatPkr } = require('../utils/formatCurrency');
const {
  ORDER_STATUS,
  PAYMENT_STATUS,
  USER_STATUS,
  ROLES,
  STOCK_MOVEMENT_TYPES,
  LEDGER_ENTRY_TYPES,
  AUDIT_ACTIONS,
} = require('../config/constants');
const env = require('../config/env');
const stockService = require('./stockService');
const ledgerService = require('./ledgerService');
const { logAudit } = require('./auditService');

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

const enrichOrder = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.totalFormatted = formatPkr(obj.total);
  obj.amountPaidFormatted = formatPkr(obj.amountPaid);
  obj.balanceDueFormatted = formatPkr(obj.balanceDue);
  return obj;
};

const shouldReduceStockNow = (trigger) => {
  const mode = env.business.stockReduceOn || 'placement';
  return mode === trigger;
};

const buildItemsFromServer = async (rawItems, session = null) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw ApiError.badRequest('Order must include at least one item');
  }

  const items = [];
  let subtotal = 0;

  for (const line of rawItems) {
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw ApiError.badRequest('Each item needs a valid quantity');
    }

    const product = await Product.findOne(
      { _id: line.productId || line.product, isDeleted: false, isActive: true },
      null,
      session ? { session } : {}
    );
    if (!product) {
      throw ApiError.badRequest(`Product not found: ${line.productId || line.product}`);
    }
    if (product.minOrderQty && qty < product.minOrderQty) {
      throw ApiError.badRequest(
        `${product.name}: minimum order quantity is ${product.minOrderQty}`
      );
    }
    if (product.stockQuantity < qty) {
      throw ApiError.badRequest(
        `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`
      );
    }

    const price = product.price; // never trust client
    const lineTotal = Math.round(price * qty * 100) / 100;
    subtotal += lineTotal;

    items.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      price,
      quantity: qty,
      lineTotal,
    });
  }

  return { items, subtotal };
};

const createOrder = async (
  { customerId, items: rawItems, shippingAddress, customerNote, createdBy },
  actor
) => {
  const customer = await User.findOne({ _id: customerId, isDeleted: false });
  if (!customer) throw ApiError.notFound('Customer not found');
  if (customer.role === ROLES.CUSTOMER && customer.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden(
      'Customer account is not active. Orders cannot be placed until approved.'
    );
  }

  const settings = await Settings.getSettings();

  return withTransaction(async (session) => {
    const { items, subtotal } = await buildItemsFromServer(rawItems, session);

    const taxPercent = settings.taxPercent || 0;
    const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    const deliveryCharges = Number(settings.deliveryCharges) || 0;
    const discount = 0;
    const total =
      Math.round((subtotal + taxAmount + deliveryCharges - discount) * 100) / 100;

    const orderNumber = await nextOrderNumber(session);
    const reduceOnPlace = shouldReduceStockNow('placement');

    const orderPayload = {
      orderNumber,
      customer: customer._id,
      items,
      subtotal,
      taxPercent,
      taxAmount,
      deliveryCharges,
      discount,
      total,
      amountPaid: 0,
      balanceDue: total,
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.AWAITING_PAYMENT,
      statusHistory: [
        {
          from: null,
          to: ORDER_STATUS.PENDING,
          note: 'Order placed',
          changedBy: actor?._id || createdBy || customer._id,
          changedAt: new Date(),
        },
      ],
      shippingAddress: shippingAddress || {},
      customerNote: customerNote || '',
      stockReduced: false,
      createdBy: createdBy || actor?._id || customer._id,
    };

    let order;
    if (session) {
      [order] = await Order.create([orderPayload], { session });
    } else {
      order = await Order.create(orderPayload);
    }

    if (reduceOnPlace) {
      for (const line of items) {
        await stockService.adjustStock(
          {
            productId: line.product,
            type: STOCK_MOVEMENT_TYPES.ORDER,
            quantity: line.quantity,
            reason: `Order ${orderNumber}`,
            referenceType: 'order',
            referenceId: order._id,
            performedBy: actor?._id || customer._id,
          },
          session
        );
      }
      order.stockReduced = true;
      await order.save(session ? { session } : undefined);
    }

    await ledgerService.ensureOpeningBalance(
      customer._id,
      customer.openingBalance,
      actor?._id,
      session
    );

    await ledgerService.appendEntry(
      {
        customerId: customer._id,
        type: LEDGER_ENTRY_TYPES.ORDER,
        debit: total,
        description: `Order ${orderNumber}`,
        order: order._id,
        createdBy: actor?._id || customer._id,
      },
      session
    );

    await logAudit({
      actor: actor?._id || customer._id,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Order',
      entityId: order._id,
      after: { orderNumber, total, status: order.status },
    });

    let populateQuery = Order.findById(order._id)
      .populate('customer', 'name shopName phone city')
      .populate('items.product', 'name slug images');
    if (session) populateQuery = populateQuery.session(session);
    const populated = await populateQuery;

    return {
      order: enrichOrder(populated || order),
      paymentInstructions: settings.paymentInstructions,
    };
  });
};

const changeStatus = async (orderId, { status, note = '' }, actor) => {
  const order = await Order.findOne({ _id: orderId, isDeleted: false });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw ApiError.badRequest('Cancelled orders cannot change status');
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `Cannot change status from ${order.status} to ${status}`
    );
  }

  return withTransaction(async (session) => {
    const fresh = session
      ? await Order.findById(orderId).session(session)
      : await Order.findById(orderId);

    const from = fresh.status;

    // Reduce stock on confirm if configured
    if (
      status === ORDER_STATUS.CONFIRMED &&
      shouldReduceStockNow('confirmed') &&
      !fresh.stockReduced
    ) {
      for (const line of fresh.items) {
        await stockService.adjustStock(
          {
            productId: line.product,
            type: STOCK_MOVEMENT_TYPES.ORDER,
            quantity: line.quantity,
            reason: `Order ${fresh.orderNumber} confirmed`,
            referenceType: 'order',
            referenceId: fresh._id,
            performedBy: actor._id,
          },
          session
        );
      }
      fresh.stockReduced = true;
    }

    fresh.statusHistory.push({
      from,
      to: status,
      note,
      changedBy: actor._id,
      changedAt: new Date(),
    });
    fresh.status = status;
    await fresh.save(session ? { session } : undefined);

    await logAudit({
      actor: actor._id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entityType: 'Order',
      entityId: fresh._id,
      before: { status: from },
      after: { status },
      note,
    });

    return enrichOrder(fresh);
  });
};

const cancelOrder = async (orderId, { reason = '' }, actor) => {
  const order = await Order.findOne({ _id: orderId, isDeleted: false });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw ApiError.badRequest('Order is already cancelled');
  }
  if (order.status === ORDER_STATUS.DELIVERED) {
    throw ApiError.badRequest('Delivered orders cannot be cancelled');
  }

  return withTransaction(async (session) => {
    const fresh = session
      ? await Order.findById(orderId).session(session)
      : await Order.findById(orderId);

    const from = fresh.status;

    if (fresh.stockReduced) {
      for (const line of fresh.items) {
        await stockService.adjustStock(
          {
            productId: line.product,
            type: STOCK_MOVEMENT_TYPES.CANCEL,
            quantity: line.quantity,
            reason: `Cancelled ${fresh.orderNumber}: ${reason}`,
            referenceType: 'order',
            referenceId: fresh._id,
            performedBy: actor._id,
          },
          session
        );
      }
      fresh.stockReduced = false;
    }

    // Reverse unpaid portion on ledger (credit back remaining balance due)
    const unpaid = Math.max(0, fresh.total - fresh.amountPaid);
    if (unpaid > 0) {
      await ledgerService.appendEntry(
        {
          customerId: fresh.customer,
          type: LEDGER_ENTRY_TYPES.ADJUSTMENT,
          credit: unpaid,
          description: `Order ${fresh.orderNumber} cancelled – reverse unpaid`,
          order: fresh._id,
          createdBy: actor._id,
        },
        session
      );
    }

    fresh.statusHistory.push({
      from,
      to: ORDER_STATUS.CANCELLED,
      note: reason,
      changedBy: actor._id,
      changedAt: new Date(),
    });
    fresh.status = ORDER_STATUS.CANCELLED;
    fresh.cancelledAt = new Date();
    fresh.cancelReason = reason;
    fresh.balanceDue = 0;
    await fresh.save(session ? { session } : undefined);

    await logAudit({
      actor: actor._id,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entityType: 'Order',
      entityId: fresh._id,
      before: { status: from },
      after: { status: ORDER_STATUS.CANCELLED },
      note: reason,
    });

    return enrichOrder(fresh);
  });
};

const addInternalNote = async (orderId, note, actor) => {
  const order = await Order.findOne({ _id: orderId, isDeleted: false });
  if (!order) throw ApiError.notFound('Order not found');
  order.internalNotes.push({ note, createdBy: actor._id, createdAt: new Date() });
  await order.save();
  return enrichOrder(order);
};

const getOrderById = async (orderId, { customerId = null } = {}) => {
  const filter = { _id: orderId, isDeleted: false };
  if (customerId) filter.customer = customerId;

  const order = await Order.findOne(filter)
    .populate('customer', 'name shopName phone city addresses')
    .populate('items.product', 'name slug images unit')
    .populate('statusHistory.changedBy', 'name role');

  if (!order) throw ApiError.notFound('Order not found');
  return enrichOrder(order);
};

const getOrderByNumber = async (orderNumber, { customerId = null } = {}) => {
  const filter = { orderNumber, isDeleted: false };
  if (customerId) filter.customer = customerId;
  const order = await Order.findOne(filter)
    .populate('customer', 'name shopName phone')
    .populate('items.product', 'name slug images');
  if (!order) throw ApiError.notFound('Order not found');
  return enrichOrder(order);
};

const listOrders = async (query = {}, { customerId = null } = {}) => {
  const { page, limit, skip, sort, search } = getPagination({
    ...query,
    sort: query.sort || '-createdAt',
  });

  const filter = { isDeleted: false };
  if (customerId) filter.customer = customerId;
  else if (query.customer) filter.customer = query.customer;

  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

  if (query.preset || query.from || query.to) {
    const { from, to } = resolveDateRange(
      query.preset || 'custom',
      query.from,
      query.to
    );
    if (from && to) filter.createdAt = { $gte: from, $lte: to };
  }

  if (search) {
    filter.$or = [
      { orderNumber: new RegExp(search, 'i') },
      { 'items.name': new RegExp(search, 'i') },
      { 'items.sku': new RegExp(search, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name shopName phone')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    items: items.map(enrichOrder),
    meta: buildMeta({ page, limit, total }),
  };
};

module.exports = {
  createOrder,
  changeStatus,
  cancelOrder,
  addInternalNote,
  getOrderById,
  getOrderByNumber,
  listOrders,
  enrichOrder,
  ALLOWED_TRANSITIONS,
};
