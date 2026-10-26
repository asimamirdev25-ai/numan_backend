require('dotenv').config();
const n = process.env.CLOUDINARY_CLOUD_NAME || '';
const k = process.env.CLOUDINARY_API_KEY || '';
const s = process.env.CLOUDINARY_API_SECRET || '';

console.log('cloud_name:', n, `(len ${n.length})`);
console.log('api_key length:', k.length);
console.log('api_secret length:', s.length);
console.log('secret quoted?', /^["'].*["']$/.test(s));
console.log('secret has whitespace?', /\s/.test(s));

if (s.length < 15) {
  console.log(
    '\nWARNING: Cloudinary API secrets are usually ~20–40 chars. Yours looks truncated.'
  );
}
