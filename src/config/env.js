const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: toInt(process.env.PORT, 5000),
  appUrl: process.env.APP_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  tz: process.env.TZ || 'Asia/Karachi',

  mongodbUri:
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/numan_cables',

  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'dev-refresh-secret-change-in-production',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
    refreshRememberExpires: process.env.JWT_REFRESH_REMEMBER_EXPIRES || '30d',
  },

  cookie: {
    secure: toBool(process.env.COOKIE_SECURE, false),
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  },

  admin: {
    name: process.env.ADMIN_NAME || 'Numan Admin',
    phone: process.env.ADMIN_PHONE || '+923001234567',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    email: process.env.ADMIN_EMAIL || 'admin@numancables.com',
  },

  shop: {
    whatsapp: process.env.SHOP_WHATSAPP || '+923157221702',
    name: process.env.SHOP_NAME || 'Numan Cables',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  otp: {
    enabled: toBool(process.env.OTP_ENABLED, false),
    expiryMinutes: toInt(process.env.OTP_EXPIRY_MINUTES, 5),
    resendCooldownSeconds: toInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
    maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
    provider: process.env.OTP_PROVIDER || 'console',
  },

  upload: {
    driver: process.env.UPLOAD_DRIVER || 'local',
    dir: process.env.UPLOAD_DIR || 'uploads',
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
  },

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 200),
    authMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
    loginLockoutAttempts: toInt(process.env.LOGIN_LOCKOUT_ATTEMPTS, 5),
    loginLockoutMinutes: toInt(process.env.LOGIN_LOCKOUT_MINUTES, 15),
  },

  business: {
    requireApproval: toBool(process.env.REQUIRE_APPROVAL, true),
    /** @type {'placement'|'confirmed'} */
    stockReduceOn: process.env.STOCK_REDUCE_ON || 'placement',
    currency: process.env.CURRENCY || 'PKR',
  },
};

module.exports = env;
