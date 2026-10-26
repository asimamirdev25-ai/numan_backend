const { User } = require('../models');
const { ROLES, USER_STATUS } = require('../config/constants');
const { verifyAccessToken } = require('../utils/tokens');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Require a valid access JWT. Attaches req.user (lean document).
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw ApiError.unauthorized('Access token required');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await User.findOne({
    _id: decoded.sub,
    isDeleted: false,
  });

  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw ApiError.forbidden('Your account has been blocked');
  }

  if (user.status === USER_STATUS.REJECTED) {
    throw ApiError.forbidden('Your account was rejected');
  }

  req.user = user;
  req.tokenPayload = decoded;
  next();
});

/**
 * Optional auth – attaches user if token present, otherwise continues.
 */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findOne({ _id: decoded.sub, isDeleted: false });
    if (user && user.status !== USER_STATUS.BLOCKED) {
      req.user = user;
      req.tokenPayload = decoded;
    }
  } catch {
    // ignore invalid optional tokens
  }
  return next();
});

/**
 * Role guard. Usage: authorize(ROLES.ADMIN) or authorize(ROLES.ADMIN, ROLES.STAFF)
 */
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }
    return next();
  };

/**
 * Customers with pending status can browse but not place orders.
 * Use on order-placement routes.
 */
const requireActiveCustomer = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.STAFF) {
    return next();
  }
  if (req.user.status === USER_STATUS.PENDING) {
    return next(
      ApiError.forbidden(
        'Your account is pending approval. You can browse products but cannot place orders yet.'
      )
    );
  }
  if (req.user.status !== USER_STATUS.ACTIVE) {
    return next(ApiError.forbidden('Account is not active'));
  }
  return next();
};

/**
 * Force password change before other actions (except the change-password route).
 */
const requirePasswordChanged = (req, _res, next) => {
  if (req.user?.mustChangePassword) {
    return next(
      new ApiError(403, 'You must change your temporary password before continuing', {
        code: 'MUST_CHANGE_PASSWORD',
      })
    );
  }
  return next();
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requireActiveCustomer,
  requirePasswordChanged,
};
