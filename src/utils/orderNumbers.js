const Counter = require('../models/Counter');
const { getTzParts } = require('./dateRange');

const pad = (n, width = 6) => String(n).padStart(width, '0');

const currentYearKarachi = () => getTzParts(new Date()).year;

/**
 * NC-2026-000123
 */
const nextOrderNumber = async (session = null) => {
  const year = currentYearKarachi();
  const seq = await Counter.next(`order-${year}`, session);
  return `NC-${year}-${pad(seq)}`;
};

/**
 * RC-2026-000045
 */
const nextReceiptNumber = async (session = null) => {
  const year = currentYearKarachi();
  const seq = await Counter.next(`receipt-${year}`, session);
  return `RC-${year}-${pad(seq)}`;
};

module.exports = { nextOrderNumber, nextReceiptNumber, currentYearKarachi };
