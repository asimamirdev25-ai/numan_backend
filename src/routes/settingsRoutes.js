const express = require('express');
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middlewares/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.get('/public', settingsController.getPublic);

router.get('/', authenticate, authorize(ROLES.ADMIN), settingsController.getAdmin);
router.patch('/', authenticate, authorize(ROLES.ADMIN), settingsController.updateAdmin);

module.exports = router;
