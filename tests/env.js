/**
 * Loaded via Jest setupFiles BEFORE any test modules.
 * Ensures env.js sees NODE_ENV=test and secrets.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
process.env.OTP_ENABLED = 'false';
process.env.REQUIRE_APPROVAL = 'true';
process.env.COOKIE_SECURE = 'false';
process.env.CLIENT_URL = 'http://localhost:5173';
