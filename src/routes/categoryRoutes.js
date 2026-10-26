const express = require('express');
const categoryController = require('../controllers/categoryController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const { ROLES } = require('../config/constants');
const {
  createCategorySchema,
  updateCategorySchema,
} = require('../validators/categoryValidators');

const router = express.Router();

/** Public */
router.get('/', categoryController.listPublic);
router.get('/slug/:slug', categoryController.getBySlug);

/** Admin */
router.get(
  '/admin/all',
  authenticate,
  authorize(ROLES.ADMIN),
  categoryController.listAdmin
);
router.get(
  '/admin/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  categoryController.getById
);
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.single('image'),
  validate(createCategorySchema),
  categoryController.create
);
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.single('image'),
  validate(updateCategorySchema),
  categoryController.update
);
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  categoryController.remove
);

module.exports = router;
