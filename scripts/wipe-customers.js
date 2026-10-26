/**
 * Hard-delete all customer accounts and related order/payment/ledger/token data.
 * Keeps admin users. Frees phone numbers for re-registration.
 */
const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const customers = await db
    .collection('users')
    .find({ role: 'customer' })
    .project({ _id: 1, phone: 1, name: 1 })
    .toArray();

  const ids = customers.map((u) => u._id);
  console.log(
    'Removing customers:',
    customers.map((u) => `${u.name} (${u.phone})`).join(', ') || '(none)'
  );

  if (ids.length) {
    const del = async (name, filter) => {
      const r = await db.collection(name).deleteMany(filter);
      console.log(`${name}: ${r.deletedCount}`);
    };

    await del('orders', { customer: { $in: ids } });
    await del('payments', { customer: { $in: ids } });
    await del('ledgerentries', { customer: { $in: ids } });
    await del('refreshtokens', { user: { $in: ids } });

    const users = await db.collection('users').deleteMany({ role: 'customer' });
    console.log(`users (customers): ${users.deletedCount}`);
  }

  const left = await db
    .collection('users')
    .find({})
    .project({ name: 1, phone: 1, role: 1 })
    .toArray();
  console.log('Remaining users:', left);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
