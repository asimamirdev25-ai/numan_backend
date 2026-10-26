const Settings = require('../models/Settings');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/** Public shop contact — safe fields only */
const getPublic = asyncHandler(async (_req, res) => {
  const s = await Settings.getSettings();
  return ApiResponse.success(res, {
    data: {
      shopName: s.shopName,
      shopPhone: s.shopPhone,
      shopWhatsapp: s.shopWhatsapp,
      shopEmail: s.shopEmail,
      shopAddress: s.shopAddress,
      city: s.city,
      logoUrl: s.logoUrl,
      social: s.social || {},
      googleReviewUrl: s.googleReviewUrl,
      googleRating: s.googleRating,
      googleReviewCount: s.googleReviewCount,
      paymentInstructions: s.paymentInstructions,
      currency: s.currency,
      timezone: s.timezone,
    },
  });
});

const getAdmin = asyncHandler(async (_req, res) => {
  const s = await Settings.getSettings();
  return ApiResponse.success(res, { data: s });
});

const updateAdmin = asyncHandler(async (req, res) => {
  const s = await Settings.getSettings();
  const allowed = [
    'shopName',
    'shopPhone',
    'shopWhatsapp',
    'shopEmail',
    'shopAddress',
    'city',
    'logoUrl',
    'googleReviewUrl',
    'googleRating',
    'googleReviewCount',
    'requireApproval',
    'lowStockThresholdDefault',
    'taxPercent',
    'deliveryCharges',
    'invoiceFooter',
    'paymentInstructions',
    'social',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) s[key] = req.body[key];
  }
  await s.save();
  return ApiResponse.success(res, { message: 'Settings updated', data: s });
});

module.exports = { getPublic, getAdmin, updateAdmin };
