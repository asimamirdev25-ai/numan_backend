const { z } = require('zod');
const { PRODUCT_UNITS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const boolFromForm = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0' || val === '') return false;
  return val;
}, z.boolean());

const attributeSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
});

const coerceAttributes = z.preprocess((val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.array(attributeSchema).optional().default([]));

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(160).optional(),
  sku: z.string().trim().max(64).optional(),
  description: z.string().trim().max(10000).optional().default(''),
  shortDescription: z.string().trim().max(500).optional().default(''),
  category: objectId,
  attributes: coerceAttributes,
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).optional().default(0),
  compareAtPrice: z.coerce.number().min(0).optional().default(0),
  unit: z.enum(Object.values(PRODUCT_UNITS)).optional().default(PRODUCT_UNITS.COIL),
  stockQuantity: z.coerce.number().min(0).optional().default(0),
  lowStockThreshold: z.coerce.number().min(0).optional().default(10),
  minOrderQty: z.coerce.number().int().min(1).optional().default(1),
  isActive: boolFromForm.optional().default(true),
  isFeatured: boolFromForm.optional().default(false),
  isNewArrival: boolFromForm.optional().default(false),
  metaTitle: z.string().trim().max(160).optional().default(''),
  metaDescription: z.string().trim().max(320).optional().default(''),
  brand: z.string().trim().max(80).optional().default('Numan Cables'),
});

const updateProductSchema = createProductSchema.partial().omit({ stockQuantity: true });

const stockAdjustSchema = z.object({
  type: z.enum(['add', 'deduct', 'set']),
  quantity: z.coerce.number().min(0),
  reason: z.string().trim().max(500).optional().default(''),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  stockAdjustSchema,
  objectId,
};
