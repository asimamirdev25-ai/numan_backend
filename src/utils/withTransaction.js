const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Run `fn(session)` inside a MongoDB transaction when supported (replica set).
 * On standalone MongoDB (typical local/dev), falls back to `fn(null)` without a session.
 *
 * Production should use a replica set so order create/cancel stay atomic.
 */
const withTransaction = async (fn) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore abort errors
      }
    }

    const msg = err.message || '';
    const unsupported =
      err.codeName === 'IllegalOperation' ||
      err.code === 20 ||
      msg.includes('Transaction numbers are only allowed') ||
      msg.includes('as a replica set') ||
      msg.includes('not supported for this topology');

    if (unsupported) {
      logger.warn(
        'MongoDB transactions unavailable (standalone?). Falling back without session.'
      );
      return fn(null);
    }
    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

module.exports = withTransaction;
