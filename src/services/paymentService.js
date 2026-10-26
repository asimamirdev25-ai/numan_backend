const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const withTransaction = require('../utils/withTransaction');
const { nextReceiptNumber } = require('../utils/orderNumbers');
const { getPagination, buildMeta } = require('../utils/pagination');
const { resolveDateRange } = require('../utils/dateRange');
const { formatPkr } = require('../utils/formatCurrency');
const {
  ORDER_STATUS,
  PAYMENT_METHODS,
  LEDGER_ENTRY_TYPES,
  AUDIT_ACTIONS,
} = require('../config/constants');
const ledgerService = require('./ledgerService');
const { logAudit } = require('./auditService');
const imageService = require('./imageService');

const enrichPayment = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.amountFormatted = formatPkr(obj.amount);
  return obj;
};

const applyAmountToOrder = async (order, amount, session) => {
  order.amountPaid = Math.round((order.amountPaid + amount) * 100) / 100;
  order.recomputePaymentFields();
  await order.save(session ? { session } : undefined);
  return order;
};

/**
 * Record payment against an order, or FIFO across unpaid orders.
 * Overpayment → customer.creditBalance + CREDIT ledger line.
 */
const recordPayment = async (data, actor, file = null) => {
  const amt = Number(data.amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw ApiError.badRequest('Payment amount must be greater than 0');
  }
  if (!Object.values(PAYMENT_METHODS).includes(data.method)) {
    throw ApiError.badRequest('Invalid payment method');
  }

  const customerId = data.customerId;
  const customer = await User.findOne({ _id: customerId, isDeleted: false });
  if (!customer) throw ApiError.notFound('Customer not found');

  let proofImage = { url: '', publicId: '' };
  if (file) {
    proofImage = await imageService.processAndStore(file, {
      folder: 'payments',
      width: 1600,
    });
  }

  return withTransaction(async (session) => {
    let remaining = amt;
    const allocations = [];
    let linkedOrder = null;

    if (data.orderId) {
      const order = session
        ? await Order.findOne({ _id: data.orderId, isDeleted: false }).session(session)
        : await Order.findOne({ _id: data.orderId, isDeleted: false });

      if (!order) throw ApiError.notFound('Order not found');
      if (String(order.customer) !== String(customerId)) {
        throw ApiError.badRequest('Order does not belong to this customer');
      }
      if (order.status === ORDER_STATUS.CANCELLED) {
        throw ApiError.badRequest('Cannot record payment on a cancelled order');
      }

      linkedOrder = order;
      const due = Math.max(0, order.total - order.amountPaid);
      const apply = Math.min(remaining, due);
      if (apply > 0) {
        await applyAmountToOrder(order, apply, session);
        allocations.push({ order: order._id, amount: apply });
        remaining = Math.round((remaining - apply) * 100) / 100;
      }
    } else if (data.allocateFifo !== false) {
      const unpaidQuery = {
        customer: customerId,
        isDeleted: false,
        status: { $ne: ORDER_STATUS.CANCELLED },
        $expr: { $gt: ['$total', '$amountPaid'] },
      };
      const unpaidOrders = session
        ? await Order.find(unpaidQuery).sort({ createdAt: 1 }).session(session)
        : await Order.find(unpaidQuery).sort({ createdAt: 1 });

      for (const order of unpaidOrders) {
        if (remaining <= 0) break;
        const due = Math.max(0, order.total - order.amountPaid);
        const apply = Math.min(remaining, due);
        if (apply <= 0) continue;
        await applyAmountToOrder(order, apply, session);
        allocations.push({ order: order._id, amount: apply });
        remaining = Math.round((remaining - apply) * 100) / 100;
      }
    }

    const creditApplied = remaining > 0 ? remaining : 0;
    if (creditApplied > 0) {
      const user = session
        ? await User.findById(customerId).session(session)
        : await User.findById(customerId);
      user.creditBalance =
        Math.round(((user.creditBalance || 0) + creditApplied) * 100) / 100;
      await user.save(session ? { session } : undefined);
    }

    const receiptNumber = await nextReceiptNumber(session);
    const paymentPayload = {
      receiptNumber,
      customer: customerId,
      order: linkedOrder?._id || allocations[0]?.order || null,
      allocations,
      amount: amt,
      method: data.method,
      reference: data.reference || '',
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
      note: data.note || '',
      proofImage,
      creditApplied,
      recordedBy: actor._id,
    };

    let payment;
    if (session) {
      [payment] = await Payment.create([paymentPayload], { session });
    } else {
      payment = await Payment.create(paymentPayload);
    }

    const allocatedTotal = Math.round((amt - creditApplied) * 100) / 100;
    if (allocatedTotal > 0) {
      await ledgerService.appendEntry(
        {
          customerId,
          type: LEDGER_ENTRY_TYPES.PAYMENT,
          credit: allocatedTotal,
          description: `Payment ${receiptNumber}${
            linkedOrder ? ` · ${linkedOrder.orderNumber}` : ''
          }`,
          order: linkedOrder?._id || null,
          payment: payment._id,
          entryDate: payment.paymentDate,
          createdBy: actor._id,
        },
        session
      );
    }

    if (creditApplied > 0) {
      await ledgerService.appendEntry(
        {
          customerId,
          type: LEDGER_ENTRY_TYPES.CREDIT,
          credit: creditApplied,
          description: `Overpayment credit from ${receiptNumber}`,
          payment: payment._id,
          entryDate: payment.paymentDate,
          createdBy: actor._id,
        },
        session
      );
    }

    await logAudit({
      actor: actor._id,
      action: AUDIT_ACTIONS.PAYMENT,
      entityType: 'Payment',
      entityId: payment._id,
      after: { receiptNumber, amount: amt, method: data.method, creditApplied },
    });

    let populateQuery = Payment.findById(payment._id)
      .populate('customer', 'name shopName phone')
      .populate('order', 'orderNumber total amountPaid balanceDue paymentStatus');
    if (session) populateQuery = populateQuery.session(session);
    const populated = await populateQuery;

    return enrichPayment(populated || payment);
  });
};

/**
 * Void payment: reverse allocations + credit; reversing ledger debit. Never hard-delete.
 */
const voidPayment = async (paymentId, { reason = '' }, actor) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.isVoided) throw ApiError.badRequest('Payment is already voided');

  return withTransaction(async (session) => {
    const fresh = session
      ? await Payment.findById(paymentId).session(session)
      : await Payment.findById(paymentId);

    for (const alloc of fresh.allocations || []) {
      const order = session
        ? await Order.findById(alloc.order).session(session)
        : await Order.findById(alloc.order);
      if (!order) continue;
      order.amountPaid = Math.max(
        0,
        Math.round((order.amountPaid - alloc.amount) * 100) / 100
      );
      order.recomputePaymentFields();
      await order.save(session ? { session } : undefined);
    }

    if ((!fresh.allocations || fresh.allocations.length === 0) && fresh.order) {
      const order = session
        ? await Order.findById(fresh.order).session(session)
        : await Order.findById(fresh.order);
      if (order) {
        const reverseAmt = fresh.amount - (fresh.creditApplied || 0);
        order.amountPaid = Math.max(
          0,
          Math.round((order.amountPaid - reverseAmt) * 100) / 100
        );
        order.recomputePaymentFields();
        await order.save(session ? { session } : undefined);
      }
    }

    if (fresh.creditApplied > 0) {
      const user = session
        ? await User.findById(fresh.customer).session(session)
        : await User.findById(fresh.customer);
      user.creditBalance = Math.max(
        0,
        Math.round(((user.creditBalance || 0) - fresh.creditApplied) * 100) / 100
      );
      await user.save(session ? { session } : undefined);
    }

    await ledgerService.appendEntry(
      {
        customerId: fresh.customer,
        type: LEDGER_ENTRY_TYPES.VOID_PAYMENT,
        debit: fresh.amount,
        description: `Void ${fresh.receiptNumber}: ${reason || 'voided'}`,
        order: fresh.order,
        payment: fresh._id,
        createdBy: actor._id,
      },
      session
    );

    fresh.isVoided = true;
    fresh.voidedAt = new Date();
    fresh.voidReason = reason;
    fresh.voidedBy = actor._id;
    await fresh.save(session ? { session } : undefined);

    await logAudit({
      actor: actor._id,
      action: AUDIT_ACTIONS.VOID,
      entityType: 'Payment',
      entityId: fresh._id,
      note: reason,
    });

    return enrichPayment(fresh);
  });
};

const listPayments = async (query = {}, { customerId = null } = {}) => {
  const { page, limit, skip, sort } = getPagination({
    ...query,
    sort: query.sort || '-paymentDate',
  });

  const filter = {};
  if (customerId) filter.customer = customerId;
  else if (query.customer) filter.customer = query.customer;
  if (query.order) filter.order = query.order;
  if (query.method) filter.method = query.method;
  if (query.isVoided === 'true') filter.isVoided = true;
  if (query.isVoided === 'false') filter.isVoided = false;

  if (query.preset || query.from || query.to) {
    const { from, to } = resolveDateRange(
      query.preset || 'custom',
      query.from,
      query.to
    );
    if (from && to) filter.paymentDate = { $gte: from, $lte: to };
  }

  if (query.search) {
    filter.$or = [
      { receiptNumber: new RegExp(query.search, 'i') },
      { reference: new RegExp(query.search, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('customer', 'name shopName phone')
      .populate('order', 'orderNumber total')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return {
    items: items.map(enrichPayment),
    meta: buildMeta({ page, limit, total }),
  };
};

const getPaymentById = async (id, { customerId = null } = {}) => {
  const filter = { _id: id };
  if (customerId) filter.customer = customerId;
  const payment = await Payment.findOne(filter)
    .populate('customer', 'name shopName phone')
    .populate('order', 'orderNumber total amountPaid balanceDue')
    .populate('recordedBy', 'name');
  if (!payment) throw ApiError.notFound('Payment not found');
  return enrichPayment(payment);
};

module.exports = {
  recordPayment,
  voidPayment,
  listPayments,
  getPaymentById,
  enrichPayment,
};
