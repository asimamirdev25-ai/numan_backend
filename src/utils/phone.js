/**
 * Pakistani phone helpers.
 * Accepts: 03XX-XXXXXXX, 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX
 * Normalizes to E.164: +923XXXXXXXXX
 */

const PK_LOCAL_REGEX = /^0?3[0-9]{9}$/;
const PK_E164_REGEX = /^\+923[0-9]{9}$/;

/**
 * Strip spaces, dashes, and common separators.
 */
const stripPhone = (raw) => String(raw || '').replace(/[\s\-().]/g, '');

/**
 * Format for display while typing: 03XX-XXXXXXX
 */
const formatPhoneDisplay = (raw) => {
  let digits = stripPhone(raw).replace(/\D/g, '');

  if (digits.startsWith('92') && digits.length >= 12) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.startsWith('3') && digits.length <= 10) {
    digits = `0${digits}`;
  }

  digits = digits.slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

/**
 * Normalize to +923XXXXXXXXX or return null if invalid.
 */
const normalizePhone = (raw) => {
  let digits = stripPhone(raw).replace(/\D/g, '');

  if (digits.startsWith('92') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Now expect 10 digits starting with 3
  if (!/^3[0-9]{9}$/.test(digits)) return null;
  return `+92${digits}`;
};

const isValidPakistaniPhone = (raw) => normalizePhone(raw) !== null;

/**
 * Build WhatsApp wa.me URL (digits only, no +).
 */
const whatsappLink = (e164Phone, text = '') => {
  const digits = String(e164Phone || '').replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
};

module.exports = {
  PK_LOCAL_REGEX,
  PK_E164_REGEX,
  stripPhone,
  formatPhoneDisplay,
  normalizePhone,
  isValidPakistaniPhone,
  whatsappLink,
};
