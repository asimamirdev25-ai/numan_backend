const Product = require('../models/Product');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { uniqueSlug, slugify } = require('../utils/slugify');
const { getPagination, buildMeta } = require('../utils/pagination');
const { STOCK_BADGE, AUDIT_ACTIONS, PRODUCT_UNITS } = require('../config/constants');
const { logAudit } = require('./auditService');
const imageService = require('./imageService');
const stockService = require('./stockService');
const { formatPkr } = require('../utils/formatCurrency');

const notDeleted = { isDeleted: false };

const enrichProduct = (doc) => {
  const obj = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
  obj.priceFormatted = formatPkr(obj.price);
  if (!obj.stockBadge) {
    if (obj.stockQuantity <= 0) obj.stockBadge = STOCK_BADGE.OUT_OF_STOCK;
    else if (obj.stockQuantity <= (obj.lowStockThreshold ?? 10))
      obj.stockBadge = STOCK_BADGE.LOW_STOCK;
    else obj.stockBadge = STOCK_BADGE.IN_STOCK;
  }
  return obj;
};

const assertCategory = async (categoryId) => {
  const cat = await Category.findOne({ _id: categoryId, isDeleted: false, isActive: true });
  if (!cat) throw ApiError.badRequest('Invalid or inactive category');
  return cat;
};

const generateSku = async (name) => {
  const base = slugify(name).replace(/-/g, '').slice(0, 8).toUpperCase() || 'PROD';
  let sku = `NC-${base}`;
  let n = 1;
  while (await Product.findOne({ sku, ...notDeleted })) {
    n += 1;
    sku = `NC-${base}${n}`;
  }
  return sku;
};

const createProduct = async (data, actorId, files = []) => {
  await assertCategory(data.category);

  const slug = await uniqueSlug(data.slug || data.name, async (s) =>
    Boolean(await Product.findOne({ slug: s, ...notDeleted }))
  );

  let sku = (data.sku || '').toUpperCase().trim();
  if (sku) {
    if (await Product.findOne({ sku, ...notDeleted })) {
      throw ApiError.conflict('SKU already exists');
    }
  } else {
    sku = await generateSku(data.name);
  }

  const images = [];
  for (let i = 0; i < files.length; i += 1) {
    const stored = await imageService.processAndStore(files[i], { folder: 'products' });
    images.push({
      ...stored,
      alt: data.name,
      isPrimary: i === 0,
      sortOrder: i,
    });
  }

  const openingStock = Number(data.stockQuantity) || 0;

  const product = await Product.create({
    name: data.name.trim(),
    slug,
    sku,
    description: data.description || '',
    shortDescription: data.shortDescription || '',
    category: data.category,
    images,
    attributes: Array.isArray(data.attributes) ? data.attributes : [],
    price: Number(data.price),
    costPrice: Number(data.costPrice) || 0,
    compareAtPrice: Number(data.compareAtPrice) || 0,
    unit: data.unit || PRODUCT_UNITS.COIL,
    stockQuantity: 0,
    lowStockThreshold: data.lowStockThreshold ?? 10,
    minOrderQty: data.minOrderQty ?? 1,
    isActive: data.isActive !== false,
    isFeatured: Boolean(data.isFeatured),
    isNewArrival: Boolean(data.isNewArrival),
    metaTitle: data.metaTitle || data.name,
    metaDescription: data.metaDescription || '',
    brand: data.brand || 'Numan Cables',
    createdBy: actorId,
    updatedBy: actorId,
  });

  if (openingStock > 0) {
    await stockService.adjustStock({
      productId: product._id,
      type: 'add',
      quantity: openingStock,
      reason: 'Opening stock',
      referenceType: 'manual',
      performedBy: actorId,
    });
  }

  await logAudit({
    actor: actorId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'Product',
    entityId: product._id,
    after: { name: product.name, sku: product.sku, price: product.price },
  });

  const fresh = await Product.findById(product._id).populate('category', 'name slug');
  return enrichProduct(fresh);
};

const updateProduct = async (id, data, actorId, files = []) => {
  const product = await Product.findOne({ _id: id, ...notDeleted });
  if (!product) throw ApiError.notFound('Product not found');

  if (data.category) await assertCategory(data.category);

  const fields = [
    'name',
    'description',
    'shortDescription',
    'category',
    'price',
    'costPrice',
    'compareAtPrice',
    'unit',
    'lowStockThreshold',
    'minOrderQty',
    'isActive',
    'isFeatured',
    'isNewArrival',
    'metaTitle',
    'metaDescription',
    'brand',
  ];

  for (const key of fields) {
    if (data[key] !== undefined) product[key] = data[key];
  }

  if (data.attributes !== undefined) {
    product.attributes = Array.isArray(data.attributes) ? data.attributes : [];
  }

  if (data.sku) {
    const sku = data.sku.toUpperCase().trim();
    const taken = await Product.findOne({ sku, _id: { $ne: id }, ...notDeleted });
    if (taken) throw ApiError.conflict('SKU already exists');
    product.sku = sku;
  }

  if (data.slug || data.name) {
    product.slug = await uniqueSlug(data.slug || data.name || product.name, async (s) =>
      Boolean(await Product.findOne({ slug: s, _id: { $ne: id }, ...notDeleted }))
    );
  }

  if (files.length) {
    for (let i = 0; i < files.length; i += 1) {
      const stored = await imageService.processAndStore(files[i], { folder: 'products' });
      product.images.push({
        ...stored,
        alt: product.name,
        isPrimary: product.images.length === 0 && i === 0,
        sortOrder: product.images.length + i,
      });
    }
  }

  product.updatedBy = actorId;
  await product.save();

  await logAudit({
    actor: actorId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Product',
    entityId: product._id,
    after: { name: product.name, sku: product.sku, price: product.price },
  });

  const fresh = await Product.findById(product._id).populate('category', 'name slug');
  return enrichProduct(fresh);
};

const softDeleteProduct = async (id, actorId) => {
  const product = await Product.findOne({ _id: id, ...notDeleted });
  if (!product) throw ApiError.notFound('Product not found');

  product.isDeleted = true;
  product.deletedAt = new Date();
  product.isActive = false;
  product.updatedBy = actorId;
  await product.save();

  await logAudit({
    actor: actorId,
    action: AUDIT_ACTIONS.DELETE,
    entityType: 'Product',
    entityId: product._id,
    note: 'Soft delete',
  });

  return enrichProduct(product);
};

const getProductById = async (id, { publicOnly = false } = {}) => {
  const filter = { _id: id, ...notDeleted };
  if (publicOnly) filter.isActive = true;
  const product = await Product.findOne(filter).populate('category', 'name slug');
  if (!product) throw ApiError.notFound('Product not found');
  return enrichProduct(product);
};

const getProductBySlug = async (slug, { publicOnly = true } = {}) => {
  const filter = { slug, ...notDeleted };
  if (publicOnly) filter.isActive = true;
  const product = await Product.findOne(filter).populate('category', 'name slug');
  if (!product) throw ApiError.notFound('Product not found');
  return enrichProduct(product);
};

const buildProductFilter = (query, { publicOnly = false } = {}) => {
  const filter = { ...notDeleted };

  if (publicOnly) filter.isActive = true;
  else if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

  if (query.category) filter.category = query.category;
  if (query.isFeatured === 'true') filter.isFeatured = true;
  if (query.isNewArrival === 'true') filter.isNewArrival = true;
  if (query.brand) filter.brand = new RegExp(query.brand, 'i');
  if (query.unit) filter.unit = query.unit;

  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  if (query.inStock === 'true') filter.stockQuantity = { $gt: 0 };
  if (query.stockBadge === STOCK_BADGE.OUT_OF_STOCK) filter.stockQuantity = 0;
  if (query.stockBadge === STOCK_BADGE.LOW_STOCK) {
    filter.$expr = {
      $and: [
        { $gt: ['$stockQuantity', 0] },
        { $lte: ['$stockQuantity', '$lowStockThreshold'] },
      ],
    };
  }
  if (query.stockBadge === STOCK_BADGE.IN_STOCK) {
    filter.$expr = { $gt: ['$stockQuantity', '$lowStockThreshold'] };
  }

  if (query.search) {
    filter.$text = { $search: String(query.search).trim() };
  }

  return filter;
};

const listProducts = async (query = {}, { publicOnly = false } = {}) => {
  const { page, limit, skip, sort, search } = getPagination({
    ...query,
    sort: query.sort || '-createdAt',
  });

  const filter = buildProductFilter({ ...query, search }, { publicOnly });

  if (query.categorySlug) {
    const cat = await Category.findOne({
      slug: query.categorySlug,
      isDeleted: false,
    });
    if (!cat) {
      return { items: [], meta: buildMeta({ page, limit, total: 0 }) };
    }
    filter.category = cat._id;
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Product.countDocuments(filter),
  ]);

  return {
    items: items.map(enrichProduct),
    meta: buildMeta({ page, limit, total }),
  };
};

const getRelatedProducts = async (productId, limit = 4) => {
  const product = await Product.findOne({ _id: productId, ...notDeleted });
  if (!product) return [];

  const items = await Product.find({
    ...notDeleted,
    isActive: true,
    category: product.category,
    _id: { $ne: product._id },
  })
    .limit(limit)
    .select('name slug sku price images unit stockQuantity lowStockThreshold brand')
    .lean({ virtuals: true });

  return items.map(enrichProduct);
};

const removeProductImage = async (productId, imageId, actorId) => {
  const product = await Product.findOne({ _id: productId, ...notDeleted });
  if (!product) throw ApiError.notFound('Product not found');

  const image = product.images.id(imageId);
  if (!image) throw ApiError.notFound('Image not found');

  if (image.publicId) await imageService.deleteStored(image.publicId);
  image.deleteOne();

  if (product.images.length && !product.images.some((i) => i.isPrimary)) {
    product.images[0].isPrimary = true;
  }

  product.updatedBy = actorId;
  await product.save();
  return enrichProduct(product);
};

module.exports = {
  createProduct,
  updateProduct,
  softDeleteProduct,
  getProductById,
  getProductBySlug,
  listProducts,
  getRelatedProducts,
  removeProductImage,
  enrichProduct,
};
