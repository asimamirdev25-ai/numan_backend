class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {object} [options]
   * @param {Array|object} [options.errors]
   * @param {boolean} [options.isOperational]
   * @param {string} [options.code]
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = options.errors || null;
    this.code = options.code || null;
    this.isOperational = options.isOperational !== false;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors) {
    return new ApiError(400, message, { errors, code: 'BAD_REQUEST' });
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message, { code: 'CONFLICT' });
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, { code: 'TOO_MANY_REQUESTS' });
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, { code: 'INTERNAL', isOperational: false });
  }
}

module.exports = ApiError;
