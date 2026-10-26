const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, USER_STATUS } = require('../config/constants');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Default' },
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    shopName: { type: String, trim: true, maxlength: 160, default: '' },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      default: undefined,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      default: undefined,
    },
    passwordHash: { type: String, select: false },
    mustChangePassword: { type: Boolean, default: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
      index: true,
    },
    city: { type: String, trim: true, default: '' },
    addresses: [addressSchema],
    ntn: { type: String, trim: true, default: '' },
    cnic: { type: String, trim: true, default: '' },
    openingBalance: { type: Number, default: 0 },
    creditBalance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING,
      index: true,
    },
    verificationCode: { type: String, select: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    passwordChangedAt: { type: Date },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.verificationCode;
        delete ret.failedLoginAttempts;
        delete ret.lockUntil;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ status: 1, role: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ shopName: 'text', name: 'text', phone: 'text' });

userSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.isLocked = function isLocked() {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

userSchema.pre('save', function preSave(next) {
  if (this.email === '' || this.email === null) this.email = undefined;
  if (this.googleId === '' || this.googleId === null) this.googleId = undefined;
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
