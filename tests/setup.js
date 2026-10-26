const mongoose = require('mongoose');

/**
 * Prefer local MongoDB test DB (reliable on Windows).
 * Optionally set TEST_MONGODB_URI. Falls back to mongodb-memory-server
 * only if USE_MEMORY_MONGO=true (requires VC++ redistributable on Windows).
 */
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
  process.env.OTP_ENABLED = 'false';
  process.env.REQUIRE_APPROVAL = 'true';

  let uri =
    process.env.TEST_MONGODB_URI ||
    'mongodb://127.0.0.1:27017/numan_cables_test';

  if (process.env.USE_MEMORY_MONGO === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    global.__MONGO_MEMORY__ = await MongoMemoryServer.create();
    uri = global.__MONGO_MEMORY__.getUri();
  }

  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (global.__MONGO_MEMORY__) {
    await global.__MONGO_MEMORY__.stop();
  }
});
