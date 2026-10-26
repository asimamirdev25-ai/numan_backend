const ApiError = require('../utils/ApiError');

/**
 * Zod schema validator middleware factory.
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.') || source,
      message: e.message,
    }));
    return next(ApiError.badRequest('Validation failed', errors));
  }
  req[source] = result.data;
  return next();
};

module.exports = validate;
