const { z } = require('zod');
const { PAYMENT_METHODS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const boolFromForm = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0' || val === '') return false;
  return val;
}, z.boolean());

const recordPaymentSchema = z.object({
  customerId: objectId,
  orderId: objectId.optional().nullable(),
  amount: z.coerce.number().positive(),
  method: z.enum(Object.values(PAYMENT_METHODS)),
  reference: z.string().trim().max(120).optional().default(''),
  paymentDate: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().default(''),
  allocateFifo: boolFromForm.optional().default(true),
});

const voidPaymentSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

module.exports = { recordPaymentSchema, voidPaymentSchema, objectId };
