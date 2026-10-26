const LedgerEntry = require('../models/LedgerEntry');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { LEDGER_ENTRY_TYPES } = require('../config/constants');
const { getPagination, buildMeta } = require('../utils/pagination');
const { resolveDateRange } = require('../utils/dateRange');
const { formatPkr } = require('../utils/formatCurrency');

const getLastBalance = async (customerId, session = null) => {
  const opts = session ? { session } : {};
  const last = await LedgerEntry.findOne({ customer: customerId }, null, opts)
    .sort({ entryDate: -1, createdAt: -1 })
    .select('balance');
  return last ? last.balance : 0;
};

/**
 * Append a ledger line and return the entry. Never deletes financial rows.
 */
const appendEntry = async (
  {
    customerId,
    type,
    debit = 0,
    credit = 0,
    description = '',
    order = null,
    payment = null,
    entryDate = new Date(),
    createdBy = null,
    meta = null,
  },
  session = null
) => {
  if (!Object.values(LEDGER_ENTRY_TYPES).includes(type)) {
    throw ApiError.badRequest('Invalid ledger entry type');
  }
  if (debit < 0 || credit < 0) {
    throw ApiError.badRequest('Debit/credit cannot be negative');
  }
  if (debit > 0 && credit > 0) {
    throw ApiError.badRequest('Entry cannot have both debit and credit');
  }

  const previous = await getLastBalance(customerId, session);
  const balance = previous + debit - credit;

  const payload = {
    customer: customerId,
    type,
    debit,
    credit,
    balance,
    description,
    order,
    payment,
    entryDate,
    createdBy,
    meta,
  };

  let entry;
  if (session) {
    [entry] = await LedgerEntry.create([payload], { session });
  } else {
    entry = await LedgerEntry.create(payload);
  }
  return entry;
};

const ensureOpeningBalance = async (customerId, openingBalance, createdBy, session = null) => {
  if (!openingBalance || openingBalance === 0) return null;

  const existing = await LedgerEntry.findOne(
    { customer: customerId, type: LEDGER_ENTRY_TYPES.OPENING_BALANCE },
    null,
    session ? { session } : {}
  );
  if (existing) return existing;

  const debit = openingBalance > 0 ? openingBalance : 0;
  const credit = openingBalance < 0 ? Math.abs(openingBalance) : 0;

  return appendEntry(
    {
      customerId,
      type: LEDGER_ENTRY_TYPES.OPENING_BALANCE,
      debit,
      credit,
      description: 'Opening balance',
      createdBy,
    },
    session
  );
};

const listCustomerLedger = async (customerId, query = {}) => {
  const customer = await User.findOne({ _id: customerId, isDeleted: false });
  if (!customer) throw ApiError.notFound('Customer not found');

  const { page, limit, skip } = getPagination(query);
  const filter = { customer: customerId };

  if (query.preset || query.from || query.to) {
    const { from, to } = resolveDateRange(
      query.preset || 'custom',
      query.from,
      query.to
    );
    if (from && to) filter.entryDate = { $gte: from, $lte: to };
  }
  if (query.type) filter.type = query.type;

  const [items, total] = await Promise.all([
    LedgerEntry.find(filter)
      .populate('order', 'orderNumber total')
      .populate('payment', 'receiptNumber amount method')
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LedgerEntry.countDocuments(filter),
  ]);

  const currentBalance = await getLastBalance(customerId);

  return {
    items: items.map((e) => ({
      ...e,
      debitFormatted: formatPkr(e.debit),
      creditFormatted: formatPkr(e.credit),
      balanceFormatted: formatPkr(e.balance),
    })),
    meta: buildMeta({ page, limit, total }),
    summary: {
      currentBalance,
      currentBalanceFormatted: formatPkr(currentBalance),
      creditBalance: customer.creditBalance || 0,
    },
  };
};

const listOverallLedger = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.customer) filter.customer = query.customer;
  if (query.type) filter.type = query.type;
  if (query.preset || query.from || query.to) {
    const { from, to } = resolveDateRange(
      query.preset || 'custom',
      query.from,
      query.to
    );
    if (from && to) filter.entryDate = { $gte: from, $lte: to };
  }

  const [items, total] = await Promise.all([
    LedgerEntry.find(filter)
      .populate('customer', 'name shopName phone')
      .populate('order', 'orderNumber')
      .populate('payment', 'receiptNumber')
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LedgerEntry.countDocuments(filter),
  ]);

  return { items, meta: buildMeta({ page, limit, total }) };
};

module.exports = {
  appendEntry,
  getLastBalance,
  ensureOpeningBalance,
  listCustomerLedger,
  listOverallLedger,
};
