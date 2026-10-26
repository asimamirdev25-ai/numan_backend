const cloudinary = require('cloudinary').v2;
const env = require('./env');

let configured = false;

const ensureCloudinary = () => {
  const { cloudName, apiKey, apiSecret } = env.upload.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
};

module.exports = { ensureCloudinary };
