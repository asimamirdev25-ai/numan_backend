const express = require('express');
const slideController = require('../controllers/slideController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const { ROLES } = require('../config/constants');
const {
  createSlideSchema,
  updateSlideSchema,
} = require('../validators/slideValidators');

const router = express.Router();

router.get('/', slideController.listPublic);

router.get(
  '/admin/all',
  authenticate,
  authorize(ROLES.ADMIN),
  slideController.listAdmin
);
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.single('image'),
  validate(createSlideSchema),
  slideController.create
);
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.single('image'),
  validate(updateSlideSchema),
  slideController.update
);
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  slideController.remove
);

module.exports = router;
