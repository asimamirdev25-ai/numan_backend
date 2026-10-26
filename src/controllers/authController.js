const authService = require('../services/authService');
const otpService = require('../services/otpService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, buildMeta } = require('../utils/pagination');
const { REFRESH_COOKIE_NAME } = require('../config/constants');

const metaFromReq = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') || '',
});

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body, metaFromReq(req));
  authService.setRefreshCookie(res, result.refreshToken, result.refreshMaxAge);
  return ApiResponse.created(res, {
    message: result.requireApproval
      ? 'Account created. Pending shop approval — you can browse meanwhile.'
      : 'Welcome! Your shop account is ready. You can order wholesale now.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      verification: result.verification,
      requireApproval: result.requireApproval,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, metaFromReq(req));
  authService.setRefreshCookie(res, result.refreshToken, result.refreshMaxAge);
  return ApiResponse.success(res, {
    message: 'Logged in successfully',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService.googleLogin(req.body, metaFromReq(req));
  authService.setRefreshCookie(res, result.refreshToken, result.refreshMaxAge);
  return ApiResponse.success(res, {
    message: result.needsProfile
      ? 'Google login successful. Please complete your profile (phone + shop name).'
      : 'Logged in with Google',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      needsProfile: result.needsProfile,
      requireApproval: result.requireApproval,
    },
  });
});

const completeGoogleProfile = asyncHandler(async (req, res) => {
  const result = await authService.completeGoogleProfile(req.user._id, req.body);
  return ApiResponse.success(res, {
    message: 'Profile completed. Use WhatsApp to verify with the shop.',
    data: result,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const raw =
    req.cookies?.[REFRESH_COOKIE_NAME] ||
    req.body?.refreshToken ||
    null;
  const result = await authService.refresh(raw, metaFromReq(req));
  authService.setRefreshCookie(res, result.refreshToken, result.refreshMaxAge);
  return ApiResponse.success(res, {
    message: 'Token refreshed',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME] || null;
  await authService.logout(raw, res);
  return ApiResponse.success(res, { message: 'Logged out' });
});

const logoutEverywhere = asyncHandler(async (req, res) => {
  await authService.logoutEverywhere(req.user._id, res);
  return ApiResponse.success(res, { message: 'Logged out from all devices' });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  return ApiResponse.success(res, { data: { user } });
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user._id, req.body);
  return ApiResponse.success(res, {
    message: 'Password updated. Please log in again on other devices.',
    data: result,
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPasswordRequest(req.body.phone);
  return ApiResponse.success(res, { message: result.message, data: result });
});

const adminCreateCustomer = asyncHandler(async (req, res) => {
  const result = await authService.adminCreateCustomer(req.user._id, req.body);
  return ApiResponse.created(res, {
    message: 'Customer created. Share the temporary password securely.',
    data: result,
  });
});

const adminResetPassword = asyncHandler(async (req, res) => {
  const result = await authService.adminResetPassword(
    req.user._id,
    req.params.id,
    req.body
  );
  return ApiResponse.success(res, {
    message: 'Temporary password set. Customer must change it on next login.',
    data: result,
  });
});

const approveCustomer = asyncHandler(async (req, res) => {
  const result = await authService.approveCustomer(req.user._id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Customer approved',
    data: result,
  });
});

const rejectCustomer = asyncHandler(async (req, res) => {
  const result = await authService.rejectCustomer(
    req.user._id,
    req.params.id,
    req.body.reason
  );
  return ApiResponse.success(res, {
    message: 'Customer rejected',
    data: result,
  });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const result = await authService.deleteCustomer(req.user._id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Customer deleted',
    data: result,
  });
});

const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, search } = getPagination(req.query);
  const status = req.query.status || '';
  const result = await authService.listCustomers({ page, limit, search, status });
  return ApiResponse.success(res, {
    data: result.items,
    meta: buildMeta({ page, limit, total: result.total }),
  });
});

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await authService.getCustomerById(req.params.id);
  return ApiResponse.success(res, { data: customer });
});

const listPending = asyncHandler(async (req, res) => {
  const { page, limit, search } = getPagination(req.query);
  const result = await authService.listPendingCustomers({ page, limit, search });
  return ApiResponse.success(res, {
    data: result.items,
    meta: buildMeta({ page, limit, total: result.total }),
  });
});

const pendingCount = asyncHandler(async (_req, res) => {
  const count = await authService.pendingCount();
  return ApiResponse.success(res, { data: { count } });
});

const sendOtp = asyncHandler(async (req, res) => {
  const { normalizePhone } = require('../utils/phone');
  const phone = normalizePhone(req.body.phone);
  if (!phone) {
    const ApiError = require('../utils/ApiError');
    throw ApiError.badRequest('Invalid Pakistani phone number');
  }
  const result = await otpService.sendOtp(phone);
  return ApiResponse.success(res, { message: result.message, data: result });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { normalizePhone } = require('../utils/phone');
  const phone = normalizePhone(req.body.phone);
  if (!phone) {
    const ApiError = require('../utils/ApiError');
    throw ApiError.badRequest('Invalid Pakistani phone number');
  }
  const result = await otpService.verifyOtp(phone, req.body.code);
  return ApiResponse.success(res, { message: result.message, data: result });
});

module.exports = {
  signup,
  login,
  googleLogin,
  completeGoogleProfile,
  refresh,
  logout,
  logoutEverywhere,
  me,
  changePassword,
  forgotPassword,
  adminCreateCustomer,
  adminResetPassword,
  approveCustomer,
  rejectCustomer,
  deleteCustomer,
  listCustomers,
  getCustomer,
  listPending,
  pendingCount,
  sendOtp,
  verifyOtp,
};
