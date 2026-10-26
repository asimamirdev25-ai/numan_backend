const express = require('express');
const ledgerController = require('../controllers/ledgerController');
const { authenticate, authorize } = require('../middlewares/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.get('/mine', authenticate, ledgerController.myLedger);

router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  ledgerController.overall
);
router.get(
  '/customers/:customerId',
  authenticate,
  authorize(ROLES.ADMIN),
  ledgerController.customerLedger
);

module.exports = router;
