const Slide = require('../models/Slide');
const ApiError = require('../utils/ApiError');
const imageService = require('./imageService');
const { getPagination, buildMeta } = require('../utils/pagination');

const listPublic = async () => {
  const items = await Slide.find({ isActive: true, isDeleted: false })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  return items;
};

const listAdmin = async (query = {}) => {
  const { page, limit, skip, sort } = getPagination({
    ...query,
    sort: query.sort || 'sortOrder',
  });
  const filter = { isDeleted: false };
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

  const [items, total] = await Promise.all([
    Slide.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Slide.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
};

const createSlide = async (data, file) => {
  let image = { url: data.imageUrl || '', publicId: '' };
  if (file) {
    image = await imageService.processAndStore(file, { folder: 'slides', width: 1920 });
  }

  return Slide.create({
    eyebrow: data.eyebrow || '',
    title: data.title,
    subtitle: data.subtitle || '',
    ctaLabel: data.ctaLabel || 'Shop now',
    ctaLink: data.ctaLink || '/shop',
    image,
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive !== false,
  });
};

const updateSlide = async (id, data, file) => {
  const slide = await Slide.findOne({ _id: id, isDeleted: false });
  if (!slide) throw ApiError.notFound('Slide not found');

  ['eyebrow', 'title', 'subtitle', 'ctaLabel', 'ctaLink', 'sortOrder', 'isActive'].forEach(
    (key) => {
      if (data[key] !== undefined) slide[key] = data[key];
    }
  );

  if (file) {
    if (slide.image?.publicId) await imageService.deleteStored(slide.image.publicId);
    slide.image = await imageService.processAndStore(file, {
      folder: 'slides',
      width: 1920,
    });
  } else if (data.imageUrl) {
    slide.image = { url: data.imageUrl, publicId: slide.image?.publicId || '' };
  }

  await slide.save();
  return slide;
};

const softDeleteSlide = async (id) => {
  const slide = await Slide.findOne({ _id: id, isDeleted: false });
  if (!slide) throw ApiError.notFound('Slide not found');
  slide.isDeleted = true;
  slide.isActive = false;
  await slide.save();
  return slide;
};

module.exports = {
  listPublic,
  listAdmin,
  createSlide,
  updateSlide,
  softDeleteSlide,
};
