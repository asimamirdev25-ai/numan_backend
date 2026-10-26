const ROLES = Object.freeze({
  ADMIN: 'admin',
  CUSTOMER: 'customer',
  STAFF: 'staff', // reserved for later
});

const USER_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  REJECTED: 'rejected',
});

const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

const PAYMENT_STATUS = Object.freeze({
  AWAITING_PAYMENT: 'awaiting_payment',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  REFUNDED: 'refunded',
});

const PAYMENT_METHODS = Object.freeze({
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  JAZZCASH: 'jazzcash',
  EASYPAISA: 'easypaisa',
  CHEQUE: 'cheque',
});

const LEDGER_ENTRY_TYPES = Object.freeze({
  OPENING_BALANCE: 'opening_balance',
  ORDER: 'order',
  PAYMENT: 'payment',
  ADJUSTMENT: 'adjustment',
  CREDIT: 'credit',
  VOID_PAYMENT: 'void_payment',
});

const STOCK_MOVEMENT_TYPES = Object.freeze({
  ADD: 'add',
  DEDUCT: 'deduct',
  SET: 'set',
  ORDER: 'order',
  CANCEL: 'cancel',
});

const PRODUCT_UNITS = Object.freeze({
  COIL: 'coil',
  METER: 'meter',
  BUNDLE: 'bundle',
  ROLL: 'roll',
  PIECE: 'piece',
  BOX: 'box',
});

const STOCK_BADGE = Object.freeze({
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
});

const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  STATUS_CHANGE: 'status_change',
  PAYMENT: 'payment',
  VOID: 'void',
  STOCK: 'stock',
  LOGIN: 'login',
  APPROVE: 'approve',
  REJECT: 'reject',
  RESET_PASSWORD: 'reset_password',
});

const REFRESH_COOKIE_NAME = 'nc_refresh_token';

const DATE_PRESETS = Object.freeze([
  'today',
  'this_week',
  'this_month',
  'last_month',
  'this_year',
  'custom',
]);

module.exports = {
  ROLES,
  USER_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  LEDGER_ENTRY_TYPES,
  STOCK_MOVEMENT_TYPES,
  PRODUCT_UNITS,
  STOCK_BADGE,
  AUDIT_ACTIONS,
  REFRESH_COOKIE_NAME,
  DATE_PRESETS,
};
