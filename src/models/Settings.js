const mongoose = require('mongoose');

/**
 * Singleton shop settings document.
 * requireApproval controls whether new self-signups need admin approval.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'shop', unique: true },
    shopName: { type: String, default: 'Numan Cables' },
    shopPhone: { type: String, default: '' },
    shopWhatsapp: { type: String, default: '' },
    shopEmail: { type: String, default: '' },
    shopAddress: { type: String, default: '' },
    city: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    social: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      youtube: { type: String, default: '' },
      tiktok: { type: String, default: '' },
      linkedin: { type: String, default: '' },
    },
    googleReviewUrl: { type: String, default: '' },
    googleRating: { type: Number, default: 4.8 },
    googleReviewCount: { type: Number, default: 0 },
    requireApproval: { type: Boolean, default: true },
    lowStockThresholdDefault: { type: Number, default: 10 },
    taxPercent: { type: Number, default: 0 },
    deliveryCharges: { type: Number, default: 0 },
    invoiceFooter: { type: String, default: 'Thank you for doing business with Numan Cables.' },
    paymentInstructions: {
      bankName: { type: String, default: '' },
      accountTitle: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      iban: { type: String, default: '' },
      jazzcash: { type: String, default: '' },
      easypaisa: { type: String, default: '' },
      notes: { type: String, default: 'Please share payment proof on WhatsApp after transfer.' },
    },
    currency: { type: String, default: 'PKR' },
    timezone: { type: String, default: 'Asia/Karachi' },
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function getSettings() {
  let doc = await this.findOne({ key: 'shop' });
  if (!doc) {
    doc = await this.create({ key: 'shop' });
  }
  return doc;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
