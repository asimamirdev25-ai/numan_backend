const { z } = require('zod');

const phoneField = z
  .string({ required_error: 'Phone number is required' })
  .min(10, 'Phone number is too short')
  .max(20, 'Phone number is too long');

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password is too long');

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required').max(120),
  phone: phoneField,
  shopName: z.string().trim().min(2, 'Shop name is required').max(160),
  password: passwordField,
});

const loginSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional().default(false),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(10, 'Google idToken is required'),
  remember: z.boolean().optional().default(false),
});

const completeGoogleProfileSchema = z.object({
  phone: phoneField,
  shopName: z.string().trim().min(2, 'Shop name is required').max(160),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional().default(''),
  newPassword: passwordField,
});

const forgotPasswordSchema = z.object({
  phone: phoneField,
});

const adminCreateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  shopName: z.string().trim().min(1).max(160),
  phone: phoneField,
  city: z.string().trim().max(80).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  email: z.string().email().optional().or(z.literal('')),
  openingBalance: z.coerce.number().optional().default(0),
  temporaryPassword: z.string().min(6).max(64).optional().or(z.literal('')),
});

const adminResetPasswordSchema = z.object({
  temporaryPassword: z.string().min(6).max(64).optional(),
});

const rejectCustomerSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

const otpSendSchema = z.object({
  phone: phoneField,
});

const otpVerifySchema = z.object({
  phone: phoneField,
  code: z.string().trim().min(4).max(8),
});

module.exports = {
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
};
