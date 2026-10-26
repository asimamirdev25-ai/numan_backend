const mongoose = require('mongoose');

const slideSchema = new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, default: '', maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, default: '', maxlength: 300 },
    ctaLabel: { type: String, trim: true, default: 'Shop now', maxlength: 40 },
    ctaLink: { type: String, trim: true, default: '/shop', maxlength: 200 },
    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

slideSchema.index({ isActive: 1, isDeleted: 1, sortOrder: 1 });

const Slide = mongoose.model('Slide', slideSchema);

module.exports = Slide;
