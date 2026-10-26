const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/ApiError');
const { STOCK_MOVEMENT_TYPES, AUDIT_ACTIONS } = require('../config/constants');
const { getPagination, buildMeta } = require('../utils/pagination');
const { logAudit } = require('./auditService');

/**
 * Adjust stock with a movement log. Use a session when part of an order transaction.
 */
const adjustStock = async (
  {
    productId,
    type,
    quantity,
    reason = '',
    referenceType = 'manual',
    referenceId = null,
    performedBy = null,
  },
  session = null
) => {
  if (!Object.values(STOCK_MOVEMENT_TYPES).includes(type)) {
    throw ApiError.badRequest('Invalid stock movement type');
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    throw ApiError.badRequest('Quantity must be a non-negative number');
  }

  const opts = session ? { session } : {};
  const product = await Product.findOne({ _id: productId, isDeleted: false }, null, opts);
  if (!product) throw ApiError.notFound('Product not found');

  const previousQuantity = product.stockQuantity;
  let newQuantity = previousQuantity;
  let delta = 0;

  switch (type) {
    case STOCK_MOVEMENT_TYPES.ADD:
      if (qty <= 0) throw ApiError.badRequest('Add quantity must be greater than 0');
      newQuantity = previousQuantity + qty;
      delta = qty;
      break;
    case STOCK_MOVEMENT_TYPES.DEDUCT:
    case STOCK_MOVEMENT_TYPES.ORDER:
      if (qty <= 0) throw ApiError.badRequest('Deduct quantity must be greater than 0');
      if (previousQuantity < qty) {
        throw ApiError.badRequest(
          `Insufficient stock for ${product.name}. Available: ${previousQuantity}`
        );
      }
      newQuantity = previousQuantity - qty;
      delta = -qty;
      break;
    case STOCK_MOVEMENT_TYPES.CANCEL:
      if (qty <= 0) throw ApiError.badRequest('Restore quantity must be greater than 0');
      newQuantity = previousQuantity + qty;
      delta = qty;
      break;
    case STOCK_MOVEMENT_TYPES.SET:
      newQuantity = qty;
      delta = newQuantity - previousQuantity;
      break;
    default:
      throw ApiError.badRequest('Unsupported stock movement');
  }

  product.stockQuantity = newQuantity;
  await product.save(opts);

  const movementPayload = {
    product: product._id,
    type,
    quantity: Math.abs(delta) || qty,
    previousQuantity,
    newQuantity,
    reason,
    referenceType,
    referenceId,
    performedBy,
  };

  let movement;
  if (session) {
    [movement] = await StockMovement.create([movementPayload], { session });
  } else {
    movement = await StockMovement.create(movementPayload);
  }

  if (performedBy && referenceType === 'manual') {
    await logAudit({
      actor: performedBy,
      action: AUDIT_ACTIONS.STOCK,
      entityType: 'Product',
      entityId: product._id,
      before: { stockQuantity: previousQuantity },
      after: { stockQuantity: newQuantity, type },
      note: reason,
    });
  }

  return { product, movement };
};

const listMovements = async (query = {}) => {
  const { page, limit, skip, sort } = getPagination(query);
  const filter = {};

  if (query.product) filter.product = query.product;
  if (query.type) filter.type = query.type;

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('product', 'name sku')
      .populate('performedBy', 'name phone')
      .sort(sort.createdAt ? sort : { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  return { items, meta: buildMeta({ page, limit, total }) };
};

const listLowStock = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);

  const pipeline = [
    {
      $match: {
        isDeleted: false,
        isActive: true,
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
      },
    },
    { $sort: { stockQuantity: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  const items = result.items || [];
  const total = result.total[0]?.count || 0;

  return { items, meta: buildMeta({ page, limit, total }) };
};

module.exports = {
  adjustStock,
  listMovements,
  listLowStock,
  /** Expose for order transactions in Phase 3 */
  withSession: async (fn) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },
};
