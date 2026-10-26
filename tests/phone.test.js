const {
  normalizePhone,
  formatPhoneDisplay,
  isValidPakistaniPhone,
  whatsappLink,
} = require('../src/utils/phone');

describe('phone utils', () => {
  it('normalizes common PK formats to E.164', () => {
    expect(normalizePhone('03001234567')).toBe('+923001234567');
    expect(normalizePhone('0300-1234567')).toBe('+923001234567');
    expect(normalizePhone('+923001234567')).toBe('+923001234567');
    expect(normalizePhone('923001234567')).toBe('+923001234567');
  });

  it('rejects invalid numbers', () => {
    expect(normalizePhone('0211234567')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
    expect(isValidPakistaniPhone('030012345')).toBe(false);
  });

  it('formats for display while typing', () => {
    expect(formatPhoneDisplay('03001234567')).toBe('0300-1234567');
  });

  it('builds WhatsApp links', () => {
    const url = whatsappLink('+923001234567', 'Hello');
    expect(url).toContain('wa.me/923001234567');
    expect(url).toContain('text=Hello');
  });
});
