const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');
const logger = require('../config/logger');
const { User, RefreshToken, Settings } = require('../models');
const { ROLES, USER_STATUS, REFRESH_COOKIE_NAME, AUDIT_ACTIONS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateVerificationCode,
  generateTempPassword,
} = require('../utils/tokens');
const { normalizePhone, whatsappLink } = require('../utils/phone');
const { logAudit } = require('./auditService');

const googleClient = env.google.clientId
  ? new OAuth2Client(env.google.clientId)
  : null;

const msFromJwtExpiry = (expiresIn) => {
  // rough parse for cookie maxAge: 15m, 7d, 30d
  const m = String(expiresIn).match(/^(\d+)([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (mult[unit] || 86_400_000);
};

const buildAuthTokens = async (user, { remember = false, userAgent = '', ip = '' } = {}) => {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    status: user.status,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload, remember);
  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    remember,
    userAgent,
    ip,
    expiresAt: new Date(decoded.exp * 1000),
  });

  return {
    accessToken,
    refreshToken,
    refreshMaxAge: msFromJwtExpiry(
      remember ? env.jwt.refreshRememberExpires : env.jwt.refreshExpires
    ),
  };
};

const publicUser = (user) => {
  const obj = user.toJSON ? user.toJSON() : user;
  return {
    id: obj._id || obj.id,
    name: obj.name,
    shopName: obj.shopName,
    phone: obj.phone,
    email: obj.email || null,
    role: obj.role,
    status: obj.status,
    city: obj.city,
    mustChangePassword: obj.mustChangePassword,
    openingBalance: obj.openingBalance,
    creditBalance: obj.creditBalance,
    lastLoginAt: obj.lastLoginAt,
    createdAt: obj.createdAt,
  };
};

const getShopWhatsapp = async () => {
  const settings = await Settings.getSettings();
  return settings.shopWhatsapp || env.shop.whatsapp || '+923157221702';
};

const buildWhatsappVerify = async (user, code) => {
  const shopNumber = await getShopWhatsapp();
  const text = `Verify my account ${code}\nName: ${user.name}\nShop: ${user.shopName}\nPhone: ${user.phone}`;
  return {
    code,
    whatsappUrl: whatsappLink(shopNumber, text),
    shopWhatsapp: shopNumber,
  };
};

const setRefreshCookie = (res, token, maxAge) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    maxAge,
    path: '/api/v1/auth',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    path: '/api/v1/auth',
  });
};

/**
 * Self signup – 4 fields. Starts as pending if requireApproval is on.
 */
const signup = async ({ name, phone, shopName, password }, meta = {}) => {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw ApiError.badRequest('Invalid Pakistani phone number. Use 03XX-XXXXXXX');
  }

  const existing = await User.findOne({ phone: normalized, isDeleted: false });
  if (existing) {
    throw ApiError.conflict('An account with this phone number already exists');
  }

  const settings = await Settings.getSettings();
  const requireApproval = settings.requireApproval ?? env.business.requireApproval;
  const verificationCode = generateVerificationCode(6);
  const passwordHash = await User.hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    shopName: shopName.trim(),
    phone: normalized,
    passwordHash,
    role: ROLES.CUSTOMER,
    status: requireApproval ? USER_STATUS.PENDING : USER_STATUS.ACTIVE,
    verificationCode,
    mustChangePassword: false,
  });

  await logAudit({
    actor: user._id,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'User',
    entityId: user._id,
    after: { phone: user.phone, status: user.status },
    note: 'Self signup',
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const tokens = await buildAuthTokens(user, {
    remember: false,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  // Professional default: instant active access (no customer WhatsApp code ritual).
  // If requireApproval is on, return a verify payload for optional manual review.
  const verification = requireApproval
    ? await buildWhatsappVerify(user, verificationCode)
    : null;

  return {
    user: publicUser(user),
    ...tokens,
    verification,
    requireApproval,
  };
};

const handleFailedLogin = async (user) => {
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const updates = { failedLoginAttempts: attempts };

  if (attempts >= env.rateLimit.loginLockoutAttempts) {
    updates.lockUntil = new Date(
      Date.now() + env.rateLimit.loginLockoutMinutes * 60 * 1000
    );
    updates.failedLoginAttempts = 0;
  }

  await User.updateOne({ _id: user._id }, { $set: updates });

  if (updates.lockUntil) {
    throw ApiError.tooManyRequests(
      `Account locked for ${env.rateLimit.loginLockoutMinutes} minutes due to failed login attempts`
    );
  }
};

const login = async ({ phone, password, remember = false }, meta = {}) => {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw ApiError.badRequest('Invalid Pakistani phone number');
  }

  const user = await User.findOne({ phone: normalized, isDeleted: false }).select(
    '+passwordHash +failedLoginAttempts +lockUntil +verificationCode'
  );

  if (!user || !user.passwordHash) {
    throw ApiError.unauthorized('Invalid phone or password');
  }

  if (user.isLocked()) {
    throw ApiError.tooManyRequests('Account temporarily locked. Try again later.');
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw ApiError.forbidden('Your account has been blocked. Contact the shop.');
  }

  if (user.status === USER_STATUS.REJECTED) {
    throw ApiError.forbidden('Your account was rejected. Contact the shop.');
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    await handleFailedLogin(user);
    throw ApiError.unauthorized('Invalid phone or password');
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await buildAuthTokens(user, {
    remember,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  await logAudit({
    actor: user._id,
    action: AUDIT_ACTIONS.LOGIN,
    entityType: 'User',
    entityId: user._id,
    note: 'Password login',
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { user: publicUser(user), ...tokens };
};

/**
 * Google Sign-In. First login asks for phone + shopName via completeGoogleProfile.
 */
const googleLogin = async ({ idToken, remember = false }, meta = {}) => {
  if (!googleClient || !env.google.clientId) {
    throw ApiError.badRequest('Google Sign-In is not configured. Set GOOGLE_CLIENT_ID.');
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.google.clientId,
    });
  } catch (err) {
    logger.warn('Google token verify failed', { message: err.message });
    throw ApiError.unauthorized('Invalid Google token');
  }

  const payload = ticket.getPayload();
  const googleId = payload.sub;
  const email = payload.email || undefined;
  const name = payload.name || 'Google User';

  let user = await User.findOne({
    $or: [{ googleId }, ...(email ? [{ email }] : [])],
    isDeleted: false,
  });

  if (user) {
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }
    if (user.status === USER_STATUS.BLOCKED || user.status === USER_STATUS.REJECTED) {
      throw ApiError.forbidden(`Your account is ${user.status}`);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await buildAuthTokens(user, {
      remember,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    const needsProfile = !user.phone || !user.shopName;
    return {
      user: publicUser(user),
      ...tokens,
      needsProfile,
    };
  }

  // New Google user – create shell account; phone/shop collected next
  const settings = await Settings.getSettings();
  const requireApproval = settings.requireApproval ?? env.business.requireApproval;
  const verificationCode = generateVerificationCode(6);

  // Temporary unique phone placeholder until profile completion
  const placeholderPhone = `+92g${googleId.slice(-9)}`;

  user = await User.create({
    name,
    email,
    googleId,
    phone: placeholderPhone,
    shopName: '',
    role: ROLES.CUSTOMER,
    status: requireApproval ? USER_STATUS.PENDING : USER_STATUS.ACTIVE,
    verificationCode,
    mustChangePassword: false,
  });

  const tokens = await buildAuthTokens(user, {
    remember,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  return {
    user: publicUser(user),
    ...tokens,
    needsProfile: true,
    requireApproval,
  };
};

/**
 * After first Google login – set real phone + shop name.
 */
const completeGoogleProfile = async (userId, { phone, shopName }) => {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw ApiError.badRequest('Invalid Pakistani phone number. Use 03XX-XXXXXXX');
  }

  const taken = await User.findOne({
    phone: normalized,
    _id: { $ne: userId },
    isDeleted: false,
  });
  if (taken) {
    throw ApiError.conflict('This phone number is already registered');
  }

  const user = await User.findById(userId).select('+verificationCode');
  if (!user || user.isDeleted) throw ApiError.notFound('User not found');

  user.phone = normalized;
  user.shopName = shopName.trim();
  if (!user.verificationCode) {
    user.verificationCode = generateVerificationCode(6);
  }
  await user.save();

  const verify = await buildWhatsappVerify(user, user.verificationCode);

  return {
    user: publicUser(user),
    verification: verify,
  };
};

/**
 * Refresh token rotation.
 */
const refresh = async (rawToken, meta = {}) => {
  if (!rawToken) throw ApiError.unauthorized('Refresh token required');

  let decoded;
  try {
    decoded = verifyRefreshToken(rawToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored || !stored.isActive()) {
    // Possible reuse attack – revoke all for user
    if (decoded?.sub) {
      await RefreshToken.updateMany(
        { user: decoded.sub, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    throw ApiError.unauthorized('Refresh token revoked or expired');
  }

  const user = await User.findOne({ _id: stored.user, isDeleted: false });
  if (!user) throw ApiError.unauthorized('User not found');
  if (user.status === USER_STATUS.BLOCKED || user.status === USER_STATUS.REJECTED) {
    throw ApiError.forbidden(`Account is ${user.status}`);
  }

  // Rotate: revoke old, issue new
  stored.revokedAt = new Date();
  const tokens = await buildAuthTokens(user, {
    remember: stored.remember,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  stored.replacedByHash = hashToken(tokens.refreshToken);
  await stored.save();

  return { user: publicUser(user), ...tokens };
};

const logout = async (rawToken, res) => {
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await RefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }
  clearRefreshCookie(res);
};

const logoutEverywhere = async (userId, res) => {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  clearRefreshCookie(res);
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  if (user.passwordHash) {
    const ok = await user.comparePassword(currentPassword);
    if (!ok) throw ApiError.badRequest('Current password is incorrect');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();

  // Invalidate other sessions
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { user: publicUser(user) };
};

/**
 * Forgot password – creates a WhatsApp request message for admin,
 * or admin can reset directly via adminResetPassword.
 */
const forgotPasswordRequest = async (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) throw ApiError.badRequest('Invalid Pakistani phone number');

  const user = await User.findOne({ phone: normalized, isDeleted: false });
  // Always return success to avoid phone enumeration
  const shopWa = await getShopWhatsapp();

  if (!user) {
    return {
      message: 'If this number is registered, the shop will help reset your password.',
      whatsappUrl: whatsappLink(
        shopWa,
        `Password reset request for phone ${normalized}`
      ),
    };
  }

  const text = `Password reset request\nName: ${user.name}\nShop: ${user.shopName}\nPhone: ${user.phone}\nPlease set a temporary password for my account.`;
  return {
    message: 'Contact the shop on WhatsApp to reset your password. The admin will set a temporary password.',
    whatsappUrl: whatsappLink(shopWa, text),
  };
};

/**
 * Admin sets a temporary password; user must change on next login.
 */
const adminResetPassword = async (adminId, userId, { temporaryPassword } = {}) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw ApiError.notFound('User not found');

  const temp = temporaryPassword || generateTempPassword(10);
  user.passwordHash = await User.hashPassword(temp);
  user.mustChangePassword = true;
  user.passwordChangedAt = new Date();
  await user.save();

  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  await logAudit({
    actor: adminId,
    action: AUDIT_ACTIONS.RESET_PASSWORD,
    entityType: 'User',
    entityId: user._id,
    note: 'Admin set temporary password',
  });

  return { temporaryPassword: temp, user: publicUser(user) };
};

/**
 * Admin creates a customer – active immediately, must change password.
 */
const adminCreateCustomer = async (adminId, data) => {
  const normalized = normalizePhone(data.phone);
  if (!normalized) throw ApiError.badRequest('Invalid Pakistani phone number');

  const exists = await User.findOne({ phone: normalized, isDeleted: false });
  if (exists) throw ApiError.conflict('Phone number already registered');

  const tempPassword =
    (data.temporaryPassword && String(data.temporaryPassword).trim()) ||
    generateTempPassword(10);
  const passwordHash = await User.hashPassword(tempPassword);

  const user = await User.create({
    name: data.name.trim(),
    shopName: (data.shopName || '').trim(),
    phone: normalized,
    email: data.email || undefined,
    city: data.city || '',
    addresses: data.address
      ? [{ label: 'Default', line1: data.address, city: data.city || '', isDefault: true }]
      : [],
    openingBalance: data.openingBalance || 0,
    passwordHash,
    mustChangePassword: true,
    role: ROLES.CUSTOMER,
    status: USER_STATUS.ACTIVE,
    createdBy: adminId,
    approvedBy: adminId,
    approvedAt: new Date(),
  });

  await logAudit({
    actor: adminId,
    action: AUDIT_ACTIONS.CREATE,
    entityType: 'User',
    entityId: user._id,
    after: { phone: user.phone, status: user.status },
    note: 'Admin-created customer',
  });

  return { user: publicUser(user), temporaryPassword: tempPassword };
};

const approveCustomer = async (adminId, userId) => {
  const user = await User.findOne({
    _id: userId,
    role: ROLES.CUSTOMER,
    isDeleted: false,
  }).select('+verificationCode');

  if (!user) throw ApiError.notFound('Customer not found');
  if (user.status === USER_STATUS.ACTIVE) {
    return { user: publicUser(user), alreadyActive: true };
  }

  user.status = USER_STATUS.ACTIVE;
  user.approvedBy = adminId;
  user.approvedAt = new Date();
  user.verificationCode = undefined;
  await user.save();

  await logAudit({
    actor: adminId,
    action: AUDIT_ACTIONS.APPROVE,
    entityType: 'User',
    entityId: user._id,
    note: 'Customer approved',
  });

  return { user: publicUser(user) };
};

const rejectCustomer = async (adminId, userId, reason = '') => {
  const user = await User.findOne({
    _id: userId,
    role: ROLES.CUSTOMER,
    isDeleted: false,
  });
  if (!user) throw ApiError.notFound('Customer not found');

  user.status = USER_STATUS.REJECTED;
  user.rejectionReason = reason;
  user.approvedBy = adminId;
  user.approvedAt = new Date();
  await user.save();

  await logAudit({
    actor: adminId,
    action: AUDIT_ACTIONS.REJECT,
    entityType: 'User',
    entityId: user._id,
    note: reason || 'Customer rejected',
  });

  return { user: publicUser(user) };
};

/**
 * Soft-delete a customer account (cannot delete admins).
 * Revokes refresh tokens so they cannot stay logged in.
 */
const deleteCustomer = async (adminId, userId) => {
  const user = await User.findOne({
    _id: userId,
    role: ROLES.CUSTOMER,
    isDeleted: false,
  });
  if (!user) throw ApiError.notFound('Customer not found');

  user.isDeleted = true;
  user.status = USER_STATUS.BLOCKED;
  await user.save();

  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  await logAudit({
    actor: adminId,
    action: AUDIT_ACTIONS.DELETE,
    entityType: 'User',
    entityId: user._id,
    note: `Customer deleted: ${user.phone} / ${user.shopName || user.name}`,
  });

  return { user: publicUser(user) };
};

const listCustomers = async ({
  page = 1,
  limit = 20,
  search = '',
  status = '',
} = {}) => {
  const filter = {
    role: ROLES.CUSTOMER,
    isDeleted: false,
  };

  if (status && Object.values(USER_STATUS).includes(status)) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { shopName: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('+verificationCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((u) => ({
      ...u,
      id: u._id,
      verificationCode: u.verificationCode,
    })),
    total,
    page,
    limit,
  };
};

const listPendingCustomers = async (opts = {}) =>
  listCustomers({ ...opts, status: USER_STATUS.PENDING });

const pendingCount = async () =>
  User.countDocuments({
    role: ROLES.CUSTOMER,
    status: USER_STATUS.PENDING,
    isDeleted: false,
  });

const getMe = async (userId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw ApiError.notFound('User not found');
  return publicUser(user);
};

const getCustomerById = async (userId) => {
  const user = await User.findOne({
    _id: userId,
    role: ROLES.CUSTOMER,
    isDeleted: false,
  }).select('+verificationCode');

  if (!user) throw ApiError.notFound('Customer not found');

  const obj = user.toObject();
  return {
    ...publicUser(user),
    verificationCode: obj.verificationCode || null,
    rejectionReason: obj.rejectionReason || null,
    approvedAt: obj.approvedAt || null,
    openingBalance: obj.openingBalance ?? 0,
    creditBalance: obj.creditBalance ?? 0,
    addresses: obj.addresses || [],
  };
};

module.exports = {
  signup,
  login,
  googleLogin,
  completeGoogleProfile,
  refresh,
  logout,
  logoutEverywhere,
  changePassword,
  forgotPasswordRequest,
  adminResetPassword,
  adminCreateCustomer,
  approveCustomer,
  rejectCustomer,
  deleteCustomer,
  listCustomers,
  listPendingCustomers,
  pendingCount,
  getMe,
  getCustomerById,
  setRefreshCookie,
  clearRefreshCookie,
  publicUser,
  REFRESH_COOKIE_NAME,
};
