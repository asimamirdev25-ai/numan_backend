const express = require('express');
const orderController = require('../controllers/orderController');
const validate = require('../middlewares/validate');
const {
  authenticate,
  authorize,
  requireActiveCustomer,
} = require('../middlewares/auth');
const { ROLES } = require('../config/constants');
const {
  createOrderSchema,
  adminCreateOrderSchema,
  changeStatusSchema,
  cancelOrderSchema,
  internalNoteSchema,
} = require('../validators/orderValidators');

const router = express.Router();

/** Customer */
router.post(
  '/',
  authenticate,
  requireActiveCustomer,
  validate(createOrderSchema),
  orderController.createMyOrder
);
router.get('/mine', authenticate, orderController.listMyOrders);
router.get('/mine/:id', authenticate, orderController.getMyOrder);
router.post(
  '/mine/:id/cancel',
  authenticate,
  validate(cancelOrderSchema),
  orderController.cancel
);

/** Admin */
router.get(
  '/admin/all',
  authenticate,
  authorize(ROLES.ADMIN),
  orderController.listAdminOrders
);
router.post(
  '/admin',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(adminCreateOrderSchema),
  orderController.adminCreateOrder
);
router.get(
  '/admin/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  orderController.getAdminOrder
);
router.patch(
  '/admin/:id/status',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(changeStatusSchema),
  orderController.changeStatus
);
router.post(
  '/admin/:id/cancel',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(cancelOrderSchema),
  orderController.cancel
);
router.post(
  '/admin/:id/notes',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(internalNoteSchema),
  orderController.addNote
);

module.exports = router;
