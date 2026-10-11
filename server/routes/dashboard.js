const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMaleHostDashboard,
  getFemaleHostDashboard,
  getAccountantDashboard,
  getRegistraDashboard,
  getMatronDashboard,
  getRegistraMaleStudents,
  getRegistraFemaleStudents
} = require('../controllers/dashboardController');

// Specific dashboard routes (longer paths first, must come before catch-all)
// Registra gender-specific routes (must come before /registra)
router.get('/registra/male-students', authenticate, authorize('Registra'), getRegistraMaleStudents);
router.get('/registra/female-students', authenticate, authorize('Registra'), getRegistraFemaleStudents);
// Other role-specific dashboards
router.get('/male-host', authenticate, authorize('Male Host Awardee'), getMaleHostDashboard);
router.get('/female-host', authenticate, authorize('Female Host Awardee'), getFemaleHostDashboard);
router.get('/accountant', authenticate, authorize('Accountant'), getAccountantDashboard);
router.get('/registra', authenticate, authorize('Registra'), getRegistraDashboard);
router.get('/matron', authenticate, authorize('Matron'), getMatronDashboard);

// Catch-all for /dashboard - redirect based on user role (must be last)
router.get('/', authenticate, (req, res) => {
  const roleRoutes = {
    'Male Host Awardee': '/dashboard/male-host',
    'Female Host Awardee': '/dashboard/female-host',
    'Accountant': '/dashboard/accountant',
    'Registra': '/dashboard/registra',
    'Matron': '/dashboard/matron'
  };
  
  const redirectPath = roleRoutes[req.user.role] || '/login';
  res.redirect(redirectPath);
});

module.exports = router;

