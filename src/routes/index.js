const express = require('express');
const authRoutes = require('./authRoutes');
const categoryRoutes = require('./categoryRoutes');
const productRoutes = require('./productRoutes');
const orderRoutes = require('./orderRoutes');
const paymentRoutes = require('./paymentRoutes');
const ledgerRoutes = require('./ledgerRoutes');
const slideRoutes = require('./slideRoutes');
const settingsRoutes = require('./settingsRoutes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Numan Cables API is healthy',
    data: {
      service: 'numan-cables-api',
      version: 'v1',
      time: new Date().toISOString(),
      timezone: process.env.TZ || 'Asia/Karachi',
    },
    meta: null,
  });
});

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/slides', slideRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
