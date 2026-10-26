/**
 * Build mongoose-friendly pagination / sort / search options from query.
 */
const getPagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  let sort = { createdAt: -1 };
  if (query.sort) {
    const fields = String(query.sort)
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
    sort = {};
    for (const field of fields) {
      if (field.startsWith('-')) sort[field.slice(1)] = -1;
      else sort[field] = 1;
    }
  }

  const search = query.search ? String(query.search).trim() : '';

  return { page, limit, skip, sort, search };
};

const buildMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

module.exports = { getPagination, buildMeta };
