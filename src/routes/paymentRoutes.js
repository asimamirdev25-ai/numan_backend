const express = require('express');
const paymentController = require('../controllers/paymentController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const { ROLES } = require('../config/constants');
const {
  recordPaymentSchema,
  voidPaymentSchema,
} = require('../validators/paymentValidators');

const router = express.Router();

/** Customer receipts */
router.get('/mine', authenticate, paymentController.listMine);
router.get('/mine/:id', authenticate, paymentController.getMine);

/** Admin */
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  paymentController.listAdmin
);
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.single('proof'),
  validate(recordPaymentSchema),
  paymentController.record
);
router.get(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  paymentController.getAdmin
);
router.post(
  '/:id/void',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(voidPaymentSchema),
  paymentController.voidPayment
);

module.exports = router;
