function normalizeUniformFee(level, status) {
  const isLevel100 = /^(?:level\s*)?100$/i.test(String(level).trim());
  if (!isLevel100) return null;
  if (!['Paid', 'Unpaid'].includes(status)) throw new Error('Select Paid or Unpaid for the Level 100 uniform fee');
  return status;
}

module.exports = { normalizeUniformFee };
