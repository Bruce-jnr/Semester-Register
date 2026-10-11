const express = require('express');
const router = express.Router();
router.use(require('../middleware/auth').authenticate);
router.use((req, res, next) => {
  const genders = { 'Male Host Awardee': 'Male', 'Female Host Awardee': 'Female' };
  const gender = genders[req.user.role];
  if (req.user.role === 'Accountant') return res.status(403).json({ error: 'Student access is not permitted' });
  if (gender) {
    const requested = req.path.match(/^\/gender\/([^/]+)/)?.[1] || req.query.gender;
    if (requested && requested !== gender) return res.status(403).json({ error: 'Gender access is not permitted' });
    req.query.gender = gender;
  }
  next();
});
const { authenticate, authorize } = require('../middleware/auth');
const {
  registerStudent,
  updateUniformFee,
  getAllStudents,
  getUnallocatedStudents,
  getStudentsByGender,
  getDistinctLevels,
  getDistinctRoomNumbers,
  allocateRoom,
  getStudentStats,
  exportStudentsToExcel,
  exportStudentsByGenderToExcel
} = require('../controllers/studentController');

// Student registration - restricted to Registra only
router.post('/', authenticate, authorize('Registra'), registerStudent);
router.patch('/:id/uniform-fee', authenticate, authorize('Registra'), updateUniformFee);
// Get all students - available to all authenticated admins
router.get('/', authenticate, getAllStudents);
router.get('/unallocated', authenticate, getUnallocatedStudents);
router.get('/gender/:gender', authenticate, getStudentsByGender);
// Export students by gender to Excel - available to all authenticated admins
router.get('/gender/:gender/export', authenticate, exportStudentsByGenderToExcel);
// Get distinct levels - available to all authenticated admins
router.get('/levels', authenticate, getDistinctLevels);
// Get distinct room numbers - available to all authenticated admins
router.get('/room-numbers', authenticate, getDistinctRoomNumbers);
// Room allocation - restricted to Registra only
router.post('/allocate', authenticate, authorize('Registra'), allocateRoom);
router.get('/stats', authenticate, getStudentStats);
// Export students to Excel - restricted to Registra only
router.get('/export', authenticate, authorize('Registra'), exportStudentsToExcel);

module.exports = router;

