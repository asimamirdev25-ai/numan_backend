/**
 * Upload existing local product + slide images to Cloudinary and update DB URLs.
 * Run: node scripts/migrate-images-to-cloudinary.js
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const sharp = require('sharp');
const { connectDB, disconnectDB } = require('../src/config/db');
const env = require('../src/config/env');
const logger = require('../src/config/logger');
const { ensureCloudinary } = require('../src/config/cloudinary');
const Product = require('../src/models/Product');
const Slide = require('../src/models/Slide');

const uploadRoot = path.resolve(process.cwd(), env.upload.dir);
const cache = new Map(); // localPath -> { url, publicId }

const isAlreadyCloud = (url) =>
  typeof url === 'string' && url.startsWith('https://res.cloudinary.com/');

const resolveLocalFile = (urlOrPublicId) => {
  if (!urlOrPublicId) return null;
  let rel = String(urlOrPublicId).replace(/^\/+/, '');
  if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
  const full = path.resolve(uploadRoot, rel);
  if (!full.startsWith(uploadRoot)) return null;
  return fs.existsSync(full) ? full : null;
};

const uploadFile = async (localPath, folder) => {
  if (cache.has(localPath)) return cache.get(localPath);

  const cloudinary = ensureCloudinary();
  if (!cloudinary) {
    throw new Error('Cloudinary credentials missing in .env');
  }

  const buffer = await sharp(localPath)
    .rotate()
    .resize({ width: folder === 'slides' ? 1920 : 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const base = path.basename(localPath, path.extname(localPath));

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `numan-cables/${folder}`,
        public_id: base,
        resource_type: 'image',
        format: 'webp',
        overwrite: true,
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    stream.end(buffer);
  });

  const stored = { url: result.secure_url, publicId: result.public_id };
  cache.set(localPath, stored);
  logger.info(`Uploaded ${path.basename(localPath)} → ${stored.publicId}`);
  return stored;
};

const migrateProducts = async () => {
  const products = await Product.find({ isDeleted: false });
  let updated = 0;

  for (const product of products) {
    if (!product.images?.length) continue;
    let changed = false;

    for (const img of product.images) {
      if (isAlreadyCloud(img.url)) continue;
      const local = resolveLocalFile(img.url) || resolveLocalFile(img.publicId);
      if (!local) {
        logger.warn(`Missing file for product ${product.sku}: ${img.url || img.publicId}`);
        continue;
      }
      const stored = await uploadFile(local, 'products');
      img.url = stored.url;
      img.publicId = stored.publicId;
      changed = true;
    }

    if (changed) {
      await product.save();
      updated += 1;
    }
  }

  return updated;
};

const migrateSlides = async () => {
  const slides = await Slide.find({ isDeleted: false });
  let updated = 0;

  for (const slide of slides) {
    const img = slide.image;
    if (!img?.url && !img?.publicId) continue;
    if (isAlreadyCloud(img.url)) continue;

    const local = resolveLocalFile(img.url) || resolveLocalFile(img.publicId);
    if (!local) {
      logger.warn(`Missing file for slide ${slide.title}: ${img.url || img.publicId}`);
      continue;
    }

    const stored = await uploadFile(local, 'slides');
    slide.image = { url: stored.url, publicId: stored.publicId };
    await slide.save();
    updated += 1;
  }

  return updated;
};

const run = async () => {
  if (env.upload.driver !== 'cloudinary') {
    logger.warn('UPLOAD_DRIVER is not cloudinary — continuing upload anyway');
  }

  await connectDB();
  const products = await migrateProducts();
  const slides = await migrateSlides();
  logger.info(
    `Done. Products updated: ${products}, slides updated: ${slides}, unique uploads: ${cache.size}`
  );
  await disconnectDB();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(err.message || err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
