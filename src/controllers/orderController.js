const orderService = require('../services/orderService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');

const createMyOrder = asyncHandler(async (req, res) => {
  const result = await orderService.createOrder(
    {
      customerId: req.user._id,
      items: req.body.items,
      shippingAddress: req.body.shippingAddress,
      customerNote: req.body.customerNote,
      createdBy: req.user._id,
    },
    req.user
  );
  return ApiResponse.created(res, {
    message: 'Order placed. Please complete payment using the instructions below.',
    data: result,
  });
});

const adminCreateOrder = asyncHandler(async (req, res) => {
  const result = await orderService.createOrder(
    {
      customerId: req.body.customerId,
      items: req.body.items,
      shippingAddress: req.body.shippingAddress,
      customerNote: req.body.customerNote,
      createdBy: req.user._id,
    },
    req.user
  );
  return ApiResponse.created(res, {
    message: 'Order created on behalf of customer',
    data: result,
  });
});

const listMyOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders(req.query, {
    customerId: req.user._id,
  });
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const listAdminOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders(req.query);
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const getMyOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, {
    customerId: req.user._id,
  });
  return ApiResponse.success(res, { data: order });
});

const getAdminOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  return ApiResponse.success(res, { data: order });
});

const changeStatus = asyncHandler(async (req, res) => {
  const order = await orderService.changeStatus(req.params.id, req.body, req.user);
  return ApiResponse.success(res, { message: 'Order status updated', data: order });
});

const cancel = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === ROLES.ADMIN;
  const order = await orderService.getOrderById(req.params.id, {
    customerId: isAdmin ? null : req.user._id,
  });

  // Customers may cancel only while pending
  if (!isAdmin && order.status !== 'pending') {
    const ApiError = require('../utils/ApiError');
    throw ApiError.forbidden('You can only cancel pending orders. Contact the shop.');
  }

  const updated = await orderService.cancelOrder(req.params.id, req.body, req.user);
  return ApiResponse.success(res, { message: 'Order cancelled', data: updated });
});

const addNote = asyncHandler(async (req, res) => {
  const order = await orderService.addInternalNote(
    req.params.id,
    req.body.note,
    req.user
  );
  return ApiResponse.success(res, { message: 'Note added', data: order });
});

module.exports = {
  createMyOrder,
  adminCreateOrder,
  listMyOrders,
  listAdminOrders,
  getMyOrder,
  getAdminOrder,
  changeStatus,
  cancel,
  addNote,
};
