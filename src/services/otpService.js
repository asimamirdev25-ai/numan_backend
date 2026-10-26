/**
 * OTP service with a provider interface.
 * OTP_ENABLED=false at launch (free-first). Plug in Firebase / SMS / Twilio later.
 *
 * Interface:
 *   sendOtp(phone) -> { success, cooldownSeconds?, message }
 *   verifyOtp(phone, code) -> { success, message }
 */

const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { generateVerificationCode } = require('../utils/tokens');

/** In-memory store for OTP (replace with Redis in production when enabling OTP). */
const otpStore = new Map();

class ConsoleOtpProvider {
  async sendOtp(phone, code) {
    logger.info(`[OTP:console] phone=${phone} code=${code}`);
    return { delivered: true, provider: 'console' };
  }
}

class FirebaseOtpProvider {
  async sendOtp(_phone, _code) {
    throw ApiError.badRequest(
      'Firebase Phone Auth provider is stubbed. Set OTP_PROVIDER and implement credentials.'
    );
  }
}

class SmsGatewayOtpProvider {
  async sendOtp(_phone, _code) {
    throw ApiError.badRequest(
      'Local SMS gateway provider is stubbed. Configure gateway credentials to enable.'
    );
  }
}

class TwilioOtpProvider {
  async sendOtp(_phone, _code) {
    throw ApiError.badRequest(
      'Twilio provider is stubbed. Configure TWILIO_* env vars to enable.'
    );
  }
}

const providers = {
  console: new ConsoleOtpProvider(),
  firebase: new FirebaseOtpProvider(),
  sms: new SmsGatewayOtpProvider(),
  twilio: new TwilioOtpProvider(),
};

const getProvider = () => {
  const key = env.otp.provider || 'console';
  return providers[key] || providers.console;
};

const getEntry = (phone) => otpStore.get(phone);

const sendOtp = async (phone) => {
  if (!env.otp.enabled) {
    throw ApiError.badRequest('OTP is disabled. Enable OTP_ENABLED to use this feature.');
  }

  const existing = getEntry(phone);
  const now = Date.now();

  if (existing?.lastSentAt) {
    const elapsed = (now - existing.lastSentAt) / 1000;
    if (elapsed < env.otp.resendCooldownSeconds) {
      const wait = Math.ceil(env.otp.resendCooldownSeconds - elapsed);
      throw ApiError.tooManyRequests(`Please wait ${wait}s before requesting another OTP`);
    }
  }

  const code = generateVerificationCode(6);
  const expiresAt = now + env.otp.expiryMinutes * 60 * 1000;

  await getProvider().sendOtp(phone, code);

  otpStore.set(phone, {
    code,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
  });

  return {
    success: true,
    message: 'OTP sent',
    cooldownSeconds: env.otp.resendCooldownSeconds,
    expiresInMinutes: env.otp.expiryMinutes,
    // Dev convenience – never returned in production
    ...(env.isProd ? {} : { debugCode: code }),
  };
};

const verifyOtp = async (phone, code) => {
  if (!env.otp.enabled) {
    throw ApiError.badRequest('OTP is disabled');
  }

  const entry = getEntry(phone);
  if (!entry) {
    throw ApiError.badRequest('No OTP requested for this phone');
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    throw ApiError.badRequest('OTP expired. Please request a new one.');
  }

  if (entry.attempts >= env.otp.maxAttempts) {
    otpStore.delete(phone);
    throw ApiError.tooManyRequests('Too many invalid OTP attempts. Request a new code.');
  }

  if (String(code).trim() !== String(entry.code)) {
    entry.attempts += 1;
    otpStore.set(phone, entry);
    throw ApiError.badRequest('Invalid OTP code');
  }

  otpStore.delete(phone);
  return { success: true, message: 'OTP verified' };
};

/** Test helper */
const _clearStore = () => otpStore.clear();

module.exports = {
  sendOtp,
  verifyOtp,
  getProvider,
  providers,
  _clearStore,
};
