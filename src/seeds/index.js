/**
 * Seed: admin, settings, categories, sample products.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { connectDB, disconnectDB } = require('../config/db');
const env = require('../config/env');
const logger = require('../config/logger');
const { User, Settings, Category, Product, StockMovement, Slide } = require('../models');
const { ROLES, USER_STATUS } = require('../config/constants');
const { normalizePhone } = require('../utils/phone');
const { slugify } = require('../utils/slugify');
const { categories: categorySeed, products: productSeed } = require('./catalog');
const { imagesForSku } = require('./imageMap');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');

const seed = async () => {
  await connectDB();

  const phone = normalizePhone(env.admin.phone) || env.admin.phone;

  let admin = await User.findOne({ phone, role: ROLES.ADMIN });
  if (!admin) {
    const passwordHash = await User.hashPassword(env.admin.password);
    admin = await User.create({
      name: env.admin.name,
      shopName: env.shop.name,
      phone,
      email: env.admin.email,
      passwordHash,
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      mustChangePassword: false,
    });
    logger.info(`Admin created: ${admin.phone}`);
  } else {
    logger.info(`Admin already exists: ${admin.phone}`);
  }

  const settings = await Settings.getSettings();
  settings.shopName = env.shop.name;
  settings.shopWhatsapp = env.shop.whatsapp;
  settings.shopPhone = env.shop.whatsapp || '+923157221702';
  settings.shopEmail = env.admin.email || 'info@numancables.com';
  settings.shopAddress = 'Electrical Market, Pakistan';
  settings.city = 'Lahore';
  settings.requireApproval = env.business.requireApproval;
  settings.timezone = env.tz;
  settings.currency = env.business.currency;
  settings.social = {
    facebook: 'https://www.facebook.com/',
    instagram: 'https://www.instagram.com/',
    youtube: 'https://www.youtube.com/',
    tiktok: '',
    linkedin: '',
  };
  // Replace with your real Google Business review link
  settings.googleReviewUrl =
    'https://search.google.com/local/writereview?placeid=REPLACE_WITH_YOUR_PLACE_ID';
  settings.googleRating = 4.8;
  settings.googleReviewCount = 126;
  settings.paymentInstructions = {
    bankName: 'HBL',
    accountTitle: 'Numan Cables',
    accountNumber: '1234567890123',
    iban: 'PK00HABB0000001234567890',
    jazzcash: '03001234567',
    easypaisa: '03001234567',
    notes: 'Please share payment proof on WhatsApp after transfer.',
  };
  await settings.save();
  logger.info('Shop settings seeded');

  const categoryMap = {};
  for (const c of categorySeed) {
    let doc = await Category.findOne({ slug: c.slug, isDeleted: false });
    if (!doc) {
      doc = await Category.create({
        ...c,
        metaTitle: `${c.name} | Numan Cables`,
        metaDescription: c.description,
        isActive: true,
      });
      logger.info(`Category: ${doc.name}`);
    }
    categoryMap[c.slug] = doc._id;
  }

  let productCount = 0;
  for (const p of productSeed) {
    const existing = await Product.findOne({ sku: p.sku, isDeleted: false });
    if (existing) continue;

    const categoryId = categoryMap[p.categorySlug];
    if (!categoryId) {
      logger.warn(`Skip product ${p.sku}: missing category ${p.categorySlug}`);
      continue;
    }

    const product = await Product.create({
      name: p.name,
      slug: slugify(p.name),
      sku: p.sku,
      description: p.shortDescription || p.name,
      shortDescription: p.shortDescription || '',
      category: categoryId,
      images: imagesForSku(p.sku, p.name),
      attributes: p.attributes || [],
      price: p.price,
      costPrice: p.costPrice || 0,
      unit: p.unit,
      stockQuantity: p.stockQuantity || 0,
      lowStockThreshold: p.lowStockThreshold ?? 10,
      minOrderQty: p.minOrderQty ?? 1,
      isActive: true,
      isFeatured: Boolean(p.isFeatured),
      isNewArrival: Boolean(p.isNewArrival),
      metaTitle: `${p.name} | Numan Cables`,
      metaDescription: p.shortDescription || p.name,
      brand: 'Numan Cables',
      createdBy: admin._id,
    });

    if (product.stockQuantity > 0) {
      await StockMovement.create({
        product: product._id,
        type: 'add',
        quantity: product.stockQuantity,
        previousQuantity: 0,
        newQuantity: product.stockQuantity,
        reason: 'Seed opening stock',
        referenceType: 'import',
        performedBy: admin._id,
      });
    }

    productCount += 1;
    logger.info(`Product: ${product.sku} – ${product.name}`);
  }

  // Sample active customers + orders
  const sampleCustomers = [
    {
      name: 'Ahmed Raza',
      shopName: 'Raza Electricals',
      phone: '+923004444001',
      city: 'Lahore',
      password: 'Customer@1',
    },
    {
      name: 'Bilal Hussain',
      shopName: 'Hussain Traders',
      phone: '+923004444002',
      city: 'Karachi',
      password: 'Customer@1',
    },
    {
      name: 'Sara Iqbal',
      shopName: 'Iqbal Cables Mart',
      phone: '+923004444003',
      city: 'Faisalabad',
      password: 'Customer@1',
    },
  ];

  const customers = [];
  for (const c of sampleCustomers) {
    let user = await User.findOne({ phone: c.phone, isDeleted: false });
    if (!user) {
      user = await User.create({
        name: c.name,
        shopName: c.shopName,
        phone: c.phone,
        city: c.city,
        passwordHash: await User.hashPassword(c.password),
        role: ROLES.CUSTOMER,
        status: USER_STATUS.ACTIVE,
        mustChangePassword: false,
        createdBy: admin._id,
        approvedBy: admin._id,
        approvedAt: new Date(),
      });
      logger.info(`Customer: ${user.shopName} (${user.phone})`);
    }
    customers.push(user);
  }

  const coilProduct = await Product.findOne({
    isDeleted: false,
    sku: 'NC-FX-0.75-3',
  });
  const midProduct = await Product.findOne({
    isDeleted: false,
    sku: 'NC-TE-2.5',
  });

  if (customers[0] && (coilProduct || midProduct)) {
    const existingOrder = await require('../models/Order').findOne({
      customer: customers[0]._id,
    });
    if (!existingOrder) {
      const items = [];
      if (coilProduct) items.push({ productId: coilProduct._id, quantity: 2 });
      if (midProduct) items.push({ productId: midProduct._id, quantity: 1 });

      const { order } = await orderService.createOrder(
        {
          customerId: customers[0]._id,
          items,
          shippingAddress: {
            name: customers[0].name,
            phone: customers[0].phone,
            city: customers[0].city,
            line1: 'Main Bazaar',
          },
          customerNote: 'Seed sample order',
          createdBy: admin._id,
        },
        admin
      );

      await paymentService.recordPayment(
        {
          customerId: customers[0]._id,
          orderId: order._id,
          amount: Math.round(order.total * 0.4),
          method: 'jazzcash',
          reference: 'SEED-PARTIAL',
          note: 'Seed partial payment',
        },
        admin
      );
      logger.info(`Sample order ${order.orderNumber} with partial payment`);
    }
  }

  const slideCount = await Slide.countDocuments({ isDeleted: false });
  if (slideCount === 0) {
    const slides = [
      {
        eyebrow: 'B2B cable supplier · Pakistan',
        title: 'Wholesale Electrical Cable & Wire',
        subtitle:
          'Numan Cables supplies twin & earth, flexible wire, SWA armoured cable, CAT6 network cable and copper earthing to electrical shops and retailers across Pakistan — live stock with clear PKR wholesale rates.',
        ctaLabel: 'Shop wholesale cables',
        ctaLink: '/shop',
        image: {
          url: '/uploads/slides/slide-cables-warehouse.jpg',
          publicId: 'slides/slide-cables-warehouse.jpg',
        },
        sortOrder: 0,
      },
      {
        eyebrow: 'Trade catalogue',
        title: 'Twin & Earth, SWA & Flex in Stock',
        subtitle:
          'Browse 2.5mm² twin & earth coils, multi-core flexible wire, steel-wire-armoured (SWA) cable by the meter, RG6 coax and earthing conductors — stock built for electrical shop counters.',
        ctaLabel: 'View full catalogue',
        ctaLink: '/shop',
        image: {
          url: '/uploads/slides/slide-copper-wire.jpg',
          publicId: 'slides/slide-copper-wire.jpg',
        },
        sortOrder: 1,
      },
      {
        eyebrow: 'Shops & retailers nationwide',
        title: 'Cable Supply for Electrical Marts',
        subtitle:
          'From Lahore and Karachi to Faisalabad, Islamabad and secondary markets — dependable wholesale cable supply for retailers who need consistent gauges, honest pricing and fast WhatsApp stock checks.',
        ctaLabel: 'Talk to order desk',
        ctaLink: '/contact',
        image: {
          url: '/uploads/slides/slide-swa-shop.jpg',
          publicId: 'slides/slide-swa-shop.jpg',
        },
        sortOrder: 2,
      },
    ];
    await Slide.insertMany(slides.map((s) => ({ ...s, isActive: true })));
    logger.info(`Homepage slides seeded: ${slides.length}`);
  }

  logger.info('--- Seed complete ---');
  logger.info(`Admin phone: ${phone}`);
  logger.info(`Categories: ${Object.keys(categoryMap).length}, new products: ${productCount}`);
  logger.info(`Sample customers password: Customer@1`);

  await disconnectDB();
  process.exit(0);
};

seed().catch(async (err) => {
  logger.error('Seed failed', { message: err.message, stack: err.stack });
  await disconnectDB().catch(() => {});
  process.exit(1);
});
