const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { authLimiter, loginLimiter } = require('../middlewares/rateLimit');
const { ROLES } = require('../config/constants');
const {
  signupSchema,
  loginSchema,
  googleLoginSchema,
  completeGoogleProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  adminCreateCustomerSchema,
  adminResetPasswordSchema,
  rejectCustomerSchema,
  otpSendSchema,
  otpVerifySchema,
} = require('../validators/authValidators');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Signup, login, tokens, OTP (optional)
 */

router.post('/signup', authLimiter, validate(signupSchema), authController.signup);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post(
  '/google',
  authLimiter,
  validate(googleLoginSchema),
  authController.googleLogin
);
router.post(
  '/google/complete-profile',
  authenticate,
  validate(completeGoogleProfileSchema),
  authController.completeGoogleProfile
);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-everywhere', authenticate, authController.logoutEverywhere);
router.get('/me', authenticate, authController.me);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

// OTP (disabled unless OTP_ENABLED=true)
router.post('/otp/send', authLimiter, validate(otpSendSchema), authController.sendOtp);
router.post(
  '/otp/verify',
  authLimiter,
  validate(otpVerifySchema),
  authController.verifyOtp
);

// Admin customer management (approval flow)
router.get(
  '/admin/customers',
  authenticate,
  authorize(ROLES.ADMIN),
  authController.listCustomers
);
router.post(
  '/admin/customers',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(adminCreateCustomerSchema),
  authController.adminCreateCustomer
);
router.post(
  '/admin/customers/:id/reset-password',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(adminResetPasswordSchema),
  authController.adminResetPassword
);
router.get(
  '/admin/customers/pending',
  authenticate,
  authorize(ROLES.ADMIN),
  authController.listPending
);
router.get(
  '/admin/customers/pending/count',
  authenticate,
  authorize(ROLES.ADMIN),
  authController.pendingCount
);
router.get(
  '/admin/customers/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  authController.getCustomer
);
router.post(
  '/admin/customers/:id/approve',
  authenticate,
  authorize(ROLES.ADMIN),
  authController.approveCustomer
);
router.post(
  '/admin/customers/:id/reject',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(rejectCustomerSchema),
  authController.rejectCustomer
);
router.delete(
  '/admin/customers/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  authController.deleteCustomer
);

module.exports = router;
