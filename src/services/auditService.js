const { AuditLog } = require('../models');
const logger = require('../config/logger');

const logAudit = async ({
  actor,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  note = '',
  ip = '',
  userAgent = '',
}) => {
  try {
    await AuditLog.create({
      actor,
      action,
      entityType,
      entityId,
      before,
      after,
      note,
      ip,
      userAgent,
    });
  } catch (err) {
    logger.error('Failed to write audit log', { message: err.message });
  }
};

module.exports = { logAudit };
