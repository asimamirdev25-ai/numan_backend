const mongoose = require('mongoose');
const { LEDGER_ENTRY_TYPES } = require('../config/constants');

/**
 * Customer ledger (statement view).
 * Convention: debit increases what customer owes; credit decreases (payments).
 * Running balance = previous + debit - credit.
 */
const ledgerEntrySchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(LEDGER_ENTRY_TYPES),
      required: true,
      index: true,
    },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true },
    description: { type: String, trim: true, default: '' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    entryDate: { type: Date, required: true, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ customer: 1, entryDate: -1, createdAt: -1 });
ledgerEntrySchema.index({ customer: 1, createdAt: -1 });

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);

module.exports = LedgerEntry;
