require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || '';
const safe = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
console.log('URI:', safe);

mongoose
  .connect(uri)
  .then(async () => {
    console.log('OK:', mongoose.connection.host, '/', mongoose.connection.name);
    const cols = await mongoose.connection.db.listCollections().toArray();
    console.log('collections:', cols.map((c) => c.name).join(', ') || '(empty — run npm run seed)');
    await mongoose.disconnect();
  })
  .catch((e) => {
    console.error('FAIL:', e.message);
    process.exit(1);
  });
