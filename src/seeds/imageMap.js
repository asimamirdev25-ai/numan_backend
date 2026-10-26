const img = (file, alt) => [
  {
    url: `/uploads/products/${file}`,
    publicId: `products/${file}`,
    alt,
    isPrimary: true,
    sortOrder: 0,
  },
];

const RULES = [
  { test: /^NC-TE-/, file: 'product-twin-earth.jpg', label: 'Twin & earth cable coil' },
  { test: /^NC-SC-/, file: 'product-single-core.jpg', label: 'Single core PVC wire' },
  { test: /^NC-FX-/, file: 'product-flexible-wire.jpg', label: 'Flexible multi-core wire' },
  { test: /^NC-SWA-/, file: 'product-swa-armoured.jpg', label: 'SWA armoured cable' },
  { test: /^NC-RG6-/, file: 'product-rg6-coax.jpg', label: 'RG6 coaxial cable' },
  { test: /^NC-CAT6-/, file: 'product-cat6-box.jpg', label: 'CAT6 network cable box' },
  { test: /^NC-EARTH-/, file: 'product-earthing-copper.jpg', label: 'Bare copper earthing cable' },
];

const imagesForSku = (sku, name) => {
  const rule = RULES.find((r) => r.test.test(sku));
  if (!rule) return [];
  return img(rule.file, `${name} – ${rule.label}`);
};

module.exports = { imagesForSku, RULES };
