const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { login, logout, resetPassword, getAllAdmins } = require('../controllers/authController');

router.post('/login', login);
router.get('/me', authenticate, (req, res) => res.json({ success: true, user: req.user }));
router.post('/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });

// Password reset - restricted to Registra only
router.post('/reset-password', authenticate, authorize('Registra'), resetPassword);
// Get all admins - restricted to Registra only
router.get('/admins', authenticate, authorize('Registra'), getAllAdmins);

module.exports = router;

