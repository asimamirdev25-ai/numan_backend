const { z } = require('zod');
const { ORDER_STATUS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const orderItemSchema = z.object({
  productId: objectId,
  quantity: z.coerce.number().int().min(1),
});

const shippingAddressSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(20).optional(),
    line1: z.string().trim().max(200).optional(),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    province: z.string().trim().max(80).optional(),
    postalCode: z.string().trim().max(20).optional(),
  })
  .optional()
  .default({});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  shippingAddress: shippingAddressSchema,
  customerNote: z.string().trim().max(1000).optional().default(''),
});

const adminCreateOrderSchema = createOrderSchema.extend({
  customerId: objectId,
});

const changeStatusSchema = z.object({
  status: z.enum([
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
  ]),
  note: z.string().trim().max(500).optional().default(''),
});

const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

const internalNoteSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});

module.exports = {
  createOrderSchema,
  adminCreateOrderSchema,
  changeStatusSchema,
  cancelOrderSchema,
  internalNoteSchema,
  objectId,
};
