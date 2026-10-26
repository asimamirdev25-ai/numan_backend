const paymentService = require('../services/paymentService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const record = asyncHandler(async (req, res) => {
  const payment = await paymentService.recordPayment(
    req.body,
    req.user,
    req.file || null
  );
  return ApiResponse.created(res, {
    message: 'Payment recorded',
    data: payment,
  });
});

const voidPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.voidPayment(req.params.id, req.body, req.user);
  return ApiResponse.success(res, { message: 'Payment voided', data: payment });
});

const listAdmin = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.query);
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const listMine = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.query, {
    customerId: req.user._id,
  });
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

const getAdmin = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id);
  return ApiResponse.success(res, { data: payment });
});

const getMine = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id, {
    customerId: req.user._id,
  });
  return ApiResponse.success(res, { data: payment });
});

module.exports = {
  record,
  voidPayment,
  listAdmin,
  listMine,
  getAdmin,
  getMine,
};
