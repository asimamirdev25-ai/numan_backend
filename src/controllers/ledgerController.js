const ledgerService = require('../services/ledgerService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const myLedger = asyncHandler(async (req, res) => {
  const result = await ledgerService.listCustomerLedger(req.user._id, req.query);
  return ApiResponse.success(res, {
    data: result.items,
    meta: { ...result.meta, summary: result.summary },
  });
});

const customerLedger = asyncHandler(async (req, res) => {
  const result = await ledgerService.listCustomerLedger(req.params.customerId, req.query);
  return ApiResponse.success(res, {
    data: result.items,
    meta: { ...result.meta, summary: result.summary },
  });
});

const overall = asyncHandler(async (req, res) => {
  const result = await ledgerService.listOverallLedger(req.query);
  return ApiResponse.success(res, { data: result.items, meta: result.meta });
});

module.exports = { myLedger, customerLedger, overall };
