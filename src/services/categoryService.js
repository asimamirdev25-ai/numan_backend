const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { uniqueSlug } = require('../utils/slugify');
const { getPagination, buildMeta } = require('../utils/pagination');
const { logAudit } = require('./auditService');
const { AUDIT_ACTIONS } = require('../config/constants');
const imageService = require('./imageService');

const notDeleted = { isDeleted: false };

const createCategory = async (data, actorId, file) => {
  const slug = await uniqueSlug(data.slug || data.name, async (s) =>
    Boolean(await Category.findOne({ slug: s, ...notDeleted }))
  );

  let image = { url: '', publicId: '' };
  if (file) {
    image = await imageService.processAndStore(file, { folder: 'categories', width: 800 });
  }

  const category = await Category.create({
    name: data.name.trim(),
    slug,
    description: data.description || '',
    image,
    parent: data.parent || null,
    sortOrder: data.sortOrder ?? 0,
    isFeatured: Boolean(data.isFeatured),
    isActive: data.isActive !== false,
    metaTitle: data.metaTitle || data.name,
    metaDescription: data.metaDescription || '',
  });

  await logAudit({
    actor: actorId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'Category',
    entityId: category._id,
    after: { name: category.name, slug: category.slug },
  });

  return category;
};

const updateCategory = async (id, data, actorId, file) => {
  const category = await Category.findOne({ _id: id, ...notDeleted });
  if (!category) throw ApiError.notFound('Category not found');

  if (data.name) category.name = data.name.trim();
  if (data.description !== undefined) category.description = data.description;
  if (data.parent !== undefined) category.parent = data.parent || null;
  if (data.sortOrder !== undefined) category.sortOrder = data.sortOrder;
  if (data.isFeatured !== undefined) category.isFeatured = data.isFeatured;
  if (data.isActive !== undefined) category.isActive = data.isActive;
  if (data.metaTitle !== undefined) category.metaTitle = data.metaTitle;
  if (data.metaDescription !== undefined) category.metaDescription = data.metaDescription;

  if (data.slug || data.name) {
    const base = data.slug || data.name || category.name;
    category.slug = await uniqueSlug(base, async (s) =>
      Boolean(await Category.findOne({ slug: s, _id: { $ne: id }, ...notDeleted }))
    );
  }

  if (file) {
    if (category.image?.publicId) {
      await imageService.deleteStored(category.image.publicId);
    }
    category.image = await imageService.processAndStore(file, {
      folder: 'categories',
      width: 800,
    });
  }

  await category.save();

  await logAudit({
    actor: actorId,
    action: AUDIT_ACTIONS.UPDATE,
    entityType: 'Category',
    entityId: category._id,
    after: { name: category.name, slug: category.slug },
  });

  return category;
};

const softDeleteCategory = async (id, actorId) => {
  const category = await Category.findOne({ _id: id, ...notDeleted });
  if (!category) throw ApiError.notFound('Category not found');

  const productCount = await Product.countDocuments({
    category: id,
    isDeleted: false,
  });
  if (productCount > 0) {
    throw ApiError.badRequest(
      `Cannot delete category with ${productCount} product(s). Move or delete products first.`
    );
  }

  category.isDeleted = true;
  category.deletedAt = new Date();
  category.isActive = false;
  await category.save();

  await logAudit({
    actor: actorId,
    action: AUDIT_ACTIONS.DELETE,
    entityType: 'Category',
    entityId: category._id,
    note: 'Soft delete',
  });

  return category;
};

const getCategoryById = async (id) => {
  const category = await Category.findOne({ _id: id, ...notDeleted });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
};

const getCategoryBySlug = async (slug, { activeOnly = true } = {}) => {
  const filter = { slug, ...notDeleted };
  if (activeOnly) filter.isActive = true;
  const category = await Category.findOne(filter);
  if (!category) throw ApiError.notFound('Category not found');
  return category;
};

const listCategories = async (query = {}, { publicOnly = false } = {}) => {
  const { page, limit, skip, sort, search } = getPagination(query);
  const filter = { ...notDeleted };

  if (publicOnly) filter.isActive = true;
  else if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

  if (query.isFeatured === 'true') filter.isFeatured = true;
  if (query.parent) filter.parent = query.parent;
  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);

  return { items, meta: buildMeta({ page, limit, total }) };
};

module.exports = {
  createCategory,
  updateCategory,
  softDeleteCategory,
  getCategoryById,
  getCategoryBySlug,
  listCategories,
};
