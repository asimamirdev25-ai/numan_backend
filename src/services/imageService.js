const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { ensureCloudinary } = require('../config/cloudinary');

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const processToWebpBuffer = async (filePath, width) => {
  try {
    return await sharp(filePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    logger.error('Image processing failed', { message: err.message });
    throw ApiError.badRequest('Could not process image. Use jpeg, png or webp.');
  }
};

const uploadToCloudinary = async (buffer, folder) => {
  const cloudinary = ensureCloudinary();
  if (!cloudinary) {
    throw ApiError.badRequest(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `numan-cables/${folder}`,
        resource_type: 'image',
        format: 'webp',
        overwrite: false,
      },
      (err, result) => {
        if (err) {
          logger.error('Cloudinary upload failed', { message: err.message });
          reject(ApiError.badRequest('Image upload to Cloudinary failed'));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
};

const storeLocally = async (buffer, folder) => {
  const destRoot = path.resolve(process.cwd(), env.upload.dir, folder);
  await ensureDir(destRoot);

  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  const destPath = path.join(destRoot, fileName);
  await fs.writeFile(destPath, buffer);

  const publicId = `${folder}/${fileName}`;
  return { url: `/uploads/${publicId}`, publicId };
};

/**
 * Process and store an uploaded image (multer file).
 * Returns { url, publicId }.
 * - local: url is /uploads/...
 * - cloudinary: url is https://res.cloudinary.com/...
 */
const processAndStore = async (file, { folder = 'products', width = 1200 } = {}) => {
  if (!file) throw ApiError.badRequest('Image file is required');

  const safeFolder = String(folder).replace(/[^a-z0-9_-]/gi, '') || 'misc';
  const buffer = await processToWebpBuffer(file.path, width);

  try {
    const useCloud =
      env.upload.driver === 'cloudinary' &&
      env.upload.cloudinary.cloudName &&
      env.upload.cloudinary.apiKey &&
      env.upload.cloudinary.apiSecret;

    if (env.upload.driver === 'cloudinary' && !useCloud) {
      logger.warn(
        'UPLOAD_DRIVER=cloudinary but credentials missing — storing image locally'
      );
    }

    if (useCloud) {
      return await uploadToCloudinary(buffer, safeFolder);
    }
    return await storeLocally(buffer, safeFolder);
  } finally {
    if (file.path) {
      await fs.unlink(file.path).catch(() => {});
    }
  }
};

const deleteStored = async (publicId) => {
  if (!publicId) return;

  // Cloudinary public ids look like "numan-cables/products/abc"
  if (String(publicId).startsWith('numan-cables/')) {
    const cloudinary = ensureCloudinary();
    if (cloudinary) {
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      } catch (err) {
        logger.warn('Cloudinary delete failed', { publicId, message: err.message });
      }
    }
    return;
  }

  const full = path.resolve(process.cwd(), env.upload.dir, publicId);
  await fs.unlink(full).catch(() => {});
};

module.exports = {
  processAndStore,
  deleteStored,
};
