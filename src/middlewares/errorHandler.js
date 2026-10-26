const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const env = require('../config/env');

const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      error = ApiError.badRequest('Validation failed', errors);
    } else if (error instanceof mongoose.Error.CastError) {
      error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
    } else if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      error = ApiError.conflict(`${field} already exists`);
    } else if (error.name === 'JsonWebTokenError') {
      error = ApiError.unauthorized('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      error = ApiError.unauthorized('Token expired');
    } else if (error.name === 'ZodError') {
      const errors = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      error = ApiError.badRequest('Validation failed', errors);
    } else {
      logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        path: req.originalUrl,
      });
      error = new ApiError(
        err.statusCode || 500,
        env.isProd ? 'Internal server error' : err.message || 'Internal server error',
        { isOperational: false, code: 'INTERNAL' }
      );
    }
  }

  if (error.statusCode >= 500) {
    logger.error(error.message, { stack: error.stack, code: error.code });
  } else {
    logger.warn(error.message, { code: error.code, path: req.originalUrl });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    data: null,
    meta: null,
    errors: error.errors || undefined,
    code: error.code || undefined,
    ...(env.isProd ? {} : { stack: error.stack }),
  });
};

module.exports = { notFoundHandler, errorHandler };
