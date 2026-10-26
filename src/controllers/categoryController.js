const categoryService = require('../services/categoryService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const listPublic = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(req.query, { publicOnly: true });
  return ApiResponse.success(res, {
    data: result.items,
    meta: result.meta,
  });
});

const listAdmin = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(req.query, { publicOnly: false });
  return ApiResponse.success(res, {
    data: result.items,
    meta: result.meta,
  });
});

const getBySlug = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryBySlug(req.params.slug);
  return ApiResponse.success(res, { data: category });
});

const getById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return ApiResponse.success(res, { data: category });
});

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(
    req.body,
    req.user._id,
    req.file || null
  );
  return ApiResponse.created(res, { message: 'Category created', data: category });
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.params.id,
    req.body,
    req.user._id,
    req.file || null
  );
  return ApiResponse.success(res, { message: 'Category updated', data: category });
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.softDeleteCategory(req.params.id, req.user._id);
  return ApiResponse.success(res, { message: 'Category deleted' });
});

module.exports = {
  listPublic,
  listAdmin,
  getBySlug,
  getById,
  create,
  update,
  remove,
};
