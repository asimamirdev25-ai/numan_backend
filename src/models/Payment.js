const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    /** Allocations when a general payment covers multiple orders */
    allocations: [
      {
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        amount: { type: Number, min: 0 },
      },
    ],
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      required: true,
    },
    reference: { type: String, trim: true, default: '' },
    paymentDate: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, default: '' },
    proofImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    /** Overpayment portion credited to customer balance */
    creditApplied: { type: Number, default: 0, min: 0 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isVoided: { type: Boolean, default: false, index: true },
    voidedAt: { type: Date },
    voidReason: { type: String, default: '' },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Link to reversing payment / ledger when voided */
    voidOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  },
  { timestamps: true }
);

paymentSchema.index({ customer: 1, paymentDate: -1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ method: 1, paymentDate: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
