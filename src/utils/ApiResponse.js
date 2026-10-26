/**
 * Consistent API response shape: { success, message, data, meta }
 */
class ApiResponse {
  static success(res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static created(res, { message = 'Created', data = null, meta = null } = {}) {
    return ApiResponse.success(res, { statusCode: 201, message, data, meta });
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

module.exports = ApiResponse;
