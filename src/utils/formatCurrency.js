/**
 * Pakistani Rupee formatting: Rs. 1,25,000 (Indian/Pak grouping).
 */
const formatPkr = (amount) => {
  const num = Number(amount) || 0;
  const negative = num < 0;
  const abs = Math.abs(num);
  const [intPart, decPart] = abs.toFixed(2).split('.');

  let lastThree = intPart.slice(-3);
  const other = intPart.slice(0, -3);
  if (other) {
    lastThree = `,${lastThree}`;
  }
  const grouped = other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const decimals = decPart === '00' ? '' : `.${decPart}`;
  return `${negative ? '-' : ''}Rs. ${grouped}${decimals}`;
};

module.exports = { formatPkr };
