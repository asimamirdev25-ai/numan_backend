const mongoose = require('mongoose');
const { PRODUCT_UNITS, STOCK_BADGE } = require('../config/constants');

const attributeSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, required: true },
    value: { type: String, trim: true, required: true },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    alt: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true, default: '', maxlength: 10000 },
    shortDescription: { type: String, trim: true, default: '', maxlength: 500 },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    images: [imageSchema],
    attributes: [attributeSchema],
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0, default: 0 },
    compareAtPrice: { type: Number, min: 0, default: 0 },
    unit: {
      type: String,
      enum: Object.values(PRODUCT_UNITS),
      default: PRODUCT_UNITS.COIL,
    },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 10 },
    minOrderQty: { type: Number, min: 1, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false },
    metaTitle: { type: String, trim: true, default: '' },
    metaDescription: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: 'Numan Cables' },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.index({ isActive: 1, isDeleted: 1, category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stockQuantity: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 'text', sku: 'text', description: 'text', brand: 'text' });

productSchema.virtual('stockBadge').get(function stockBadge() {
  if (this.stockQuantity <= 0) return STOCK_BADGE.OUT_OF_STOCK;
  if (this.stockQuantity <= (this.lowStockThreshold ?? 10)) return STOCK_BADGE.LOW_STOCK;
  return STOCK_BADGE.IN_STOCK;
});

productSchema.virtual('inStock').get(function inStock() {
  return this.stockQuantity > 0;
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
