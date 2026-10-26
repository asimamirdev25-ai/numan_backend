/**
 * URL-safe slug from a string. Keeps ASCII letters/numbers; strips Urdu/accents roughly.
 */
const slugify = (text = '') =>
  String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';

/**
 * Ensure unique slug by appending -2, -3, ... if needed.
 * @param {string} base
 * @param {(slug: string) => Promise<boolean>} existsFn - returns true if slug taken
 */
const uniqueSlug = async (base, existsFn) => {
  let slug = slugify(base);
  let n = 1;
  while (await existsFn(slug)) {
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
  return slug;
};

module.exports = { slugify, uniqueSlug };
