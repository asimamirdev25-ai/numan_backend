const { z } = require('zod');

const boolFromForm = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0' || val === '') return false;
  return val;
}, z.boolean());

const createSlideSchema = z.object({
  eyebrow: z.string().trim().max(80).optional().default(''),
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(300).optional().default(''),
  ctaLabel: z.string().trim().max(40).optional().default('Shop now'),
  ctaLink: z.string().trim().max(200).optional().default('/shop'),
  imageUrl: z.string().trim().optional().default(''),
  sortOrder: z.coerce.number().int().optional().default(0),
  isActive: boolFromForm.optional().default(true),
});

const updateSlideSchema = createSlideSchema.partial();

module.exports = { createSlideSchema, updateSlideSchema };
