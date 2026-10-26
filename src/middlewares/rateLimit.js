const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const handler = (_req, _res, next) => {
  next(ApiError.tooManyRequests('Too many requests, please try again later'));
};

const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: () => env.isTest,
});

const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: () => env.isTest,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests('Too many login attempts. Try again in 15 minutes.'));
  },
  skip: () => env.isTest,
});

module.exports = { globalLimiter, authLimiter, loginLimiter };
