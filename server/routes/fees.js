const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate, authorize('Registra', 'Accountant'));
const {
  createFee,
  getAllFees,
  getFeeStats,
  getFeesByIndexNumber,
  getDistinctLevels,
  markReceiptIssued,
  getReceipt,
  exportFeesToExcel
} = require('../controllers/feeController');

// Create fee payment - available to Registra and Accountant
router.post('/', authenticate, (req, res, next) => {
  const allowedRoles = ['Registra', 'Accountant'];
  if (allowedRoles.includes(req.user.role)) {
    return createFee(req, res, next);
  } else {
    return res.status(403).json({ error: 'Access denied. Only Registra and Accountant can create fee payments.' });
  }
});
// Get all fees - available to Accountant and Registra
router.get('/', authenticate, getAllFees);
// Get fee statistics - available to Accountant
router.get('/stats', authenticate, getFeeStats);
// Get fees by index number
router.get('/student/:index_number', authenticate, getFeesByIndexNumber);
// Get distinct levels from fees (joined with students)
router.get('/levels', authenticate, getDistinctLevels);
// Get receipt for printing - available to Accountant
router.get('/receipt/:id', authenticate, authorize('Accountant'), getReceipt);
// Export fees to Excel - available to Accountant
router.get('/export', authenticate, authorize('Accountant'), exportFeesToExcel);
// Mark receipt as issued - available to Accountant
router.post('/mark-receipt-issued', authenticate, authorize('Accountant'), markReceiptIssued);

module.exports = router;

