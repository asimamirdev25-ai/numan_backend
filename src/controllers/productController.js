const productService = require('../services/productService');
const stockService = require('../services/stockService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const listPublic = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query, { publicOnly: true });
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const listAdmin = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query, { publicOnly: false });
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const getBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);
  const related = await productService.getRelatedProducts(product._id || product.id);
  return ApiResponse.success(res, { data: { product, related } });
});

const getById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id, {
    publicOnly: req.user?.role !== 'admin',
  });
  return ApiResponse.success(res, { data: product });
});

const create = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const product = await productService.createProduct(req.body, req.user._id, files);
  return ApiResponse.created(res, { message: 'Product created', data: product });
});

const update = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const product = await productService.updateProduct(
    req.params.id,
    req.body,
    req.user._id,
    files
  );
  return ApiResponse.success(res, { message: 'Product updated', data: product });
});

const remove = asyncHandler(async (req, res) => {
  await productService.softDeleteProduct(req.params.id, req.user._id);
  return ApiResponse.success(res, { message: 'Product deleted' });
});

const removeImage = asyncHandler(async (req, res) => {
  const product = await productService.removeProductImage(
    req.params.id,
    req.params.imageId,
    req.user._id
  );
  return ApiResponse.success(res, { message: 'Image removed', data: product });
});

const adjustStock = asyncHandler(async (req, res) => {
  const result = await stockService.adjustStock({
    productId: req.params.id,
    type: req.body.type,
    quantity: req.body.quantity,
    reason: req.body.reason || '',
    referenceType: 'manual',
    performedBy: req.user._id,
  });
  return ApiResponse.success(res, {
    message: 'Stock updated',
    data: {
      product: productService.enrichProduct(result.product),
      movement: result.movement,
    },
  });
});

const listMovements = asyncHandler(async (req, res) => {
  const result = await stockService.listMovements({
    ...req.query,
    product: req.params.id || req.query.product,
  });
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const listLowStock = asyncHandler(async (req, res) => {
  const result = await stockService.listLowStock(req.query);
  return ApiResponse.success(res, {
    data: result.items.map(productService.enrichProduct),
    meta: result.meta,
  });
});

module.exports = {
  listPublic,
  listAdmin,
  getBySlug,
  getById,
  create,
  update,
  remove,
  removeImage,
  adjustStock,
  listMovements,
  listLowStock,
};
