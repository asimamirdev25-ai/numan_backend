const express = require('express');
const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const { authenticate, authorize, optionalAuth } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const { ROLES } = require('../config/constants');
const {
  createProductSchema,
  updateProductSchema,
  stockAdjustSchema,
} = require('../validators/productValidators');

const router = express.Router();

/** Public storefront */
router.get('/', productController.listPublic);
router.get('/slug/:slug', productController.getBySlug);

/** Admin stock overview */
router.get(
  '/admin/low-stock',
  authenticate,
  authorize(ROLES.ADMIN),
  productController.listLowStock
);
router.get(
  '/admin/stock-movements',
  authenticate,
  authorize(ROLES.ADMIN),
  productController.listMovements
);
router.get(
  '/admin/all',
  authenticate,
  authorize(ROLES.ADMIN),
  productController.listAdmin
);

router.get('/:id', optionalAuth, productController.getById);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.array('images', 8),
  validate(createProductSchema),
  productController.create
);

router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.array('images', 8),
  validate(updateProductSchema),
  productController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  productController.remove
);

router.delete(
  '/:id/images/:imageId',
  authenticate,
  authorize(ROLES.ADMIN),
  productController.removeImage
);

router.post(
  '/:id/stock',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(stockAdjustSchema),
  productController.adjustStock
);

router.get(
  '/:id/stock-movements',
  authenticate,
  authorize(ROLES.ADMIN),
  productController.listMovements
);

module.exports = router;
