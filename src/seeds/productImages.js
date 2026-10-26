/**
 * Attach AI product images to catalogue SKUs.
 * Run: node src/seeds/productImages.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { connectDB, disconnectDB } = require('../config/db');
const logger = require('../config/logger');
const Product = require('../models/Product');
const { imagesForSku } = require('./imageMap');

const run = async () => {
  await connectDB();
  const products = await Product.find({ isDeleted: false });
  let updated = 0;

  for (const product of products) {
    const images = imagesForSku(product.sku, product.name);
    if (!images.length) {
      logger.warn(`No image rule for SKU ${product.sku}`);
      continue;
    }
    product.images = images;
    await product.save();
    updated += 1;
    logger.info(`Image set: ${product.sku}`);
  }

  logger.info(`Done. Updated ${updated}/${products.length} products.`);
  await disconnectDB();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
