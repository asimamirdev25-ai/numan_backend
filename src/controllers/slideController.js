const slideService = require('../services/slideService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const listPublic = asyncHandler(async (_req, res) => {
  const items = await slideService.listPublic();
  return ApiResponse.success(res, { data: items });
});

const listAdmin = asyncHandler(async (req, res) => {
  const result = await slideService.listAdmin(req.query);
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const create = asyncHandler(async (req, res) => {
  const slide = await slideService.createSlide(req.body, req.file || null);
  return ApiResponse.created(res, { message: 'Slide created', data: slide });
});

const update = asyncHandler(async (req, res) => {
  const slide = await slideService.updateSlide(req.params.id, req.body, req.file || null);
  return ApiResponse.success(res, { message: 'Slide updated', data: slide });
});

const remove = asyncHandler(async (req, res) => {
  await slideService.softDeleteSlide(req.params.id);
  return ApiResponse.success(res, { message: 'Slide deleted' });
});

module.exports = { listPublic, listAdmin, create, update, remove };
