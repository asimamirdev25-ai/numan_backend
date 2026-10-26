const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires });

const signRefreshToken = (payload, remember = false) =>
  jwt.sign(
    { ...payload, jti: crypto.randomBytes(16).toString('hex') },
    env.jwt.refreshSecret,
    {
      expiresIn: remember ? env.jwt.refreshRememberExpires : env.jwt.refreshExpires,
    }
  );

const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

/** Opaque hash stored in DB for refresh token lookup / rotation */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateVerificationCode = (length = 6) => {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(length, '0');
};

const generateTempPassword = (length = 10) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateVerificationCode,
  generateTempPassword,
};
