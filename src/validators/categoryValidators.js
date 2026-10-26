const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const boolFromForm = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0' || val === '') return false;
  return val;
}, z.boolean());

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional().default(''),
  parent: objectId.optional().nullable(),
  sortOrder: z.coerce.number().int().optional().default(0),
  isFeatured: boolFromForm.optional().default(false),
  isActive: boolFromForm.optional().default(true),
  metaTitle: z.string().trim().max(160).optional().default(''),
  metaDescription: z.string().trim().max(320).optional().default(''),
});

const updateCategorySchema = createCategorySchema.partial();

module.exports = { createCategorySchema, updateCategorySchema, objectId };
