const mongoose = require('mongoose');

/**
 * Atomic sequential counters for order / receipt numbers.
 * e.g. key "order-2026" → seq 123 → NC-2026-000123
 */
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function next(key, session = null) {
  const opts = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };
  if (session) opts.session = session;

  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    opts
  );
  return doc.seq;
};

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
