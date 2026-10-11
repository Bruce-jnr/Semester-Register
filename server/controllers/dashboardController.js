const Student = require('../models/student');
const Room = require('../models/room');

const getMaleHostDashboard = async (req, res) => {
  try {
    const result = await Student.findByGender('Male', 1, 50);
    const stats = await Student.getStats();
    res.render('dashboards/male-host', {
      students: result.students,
      stats,
      user: req.user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
};

const getFemaleHostDashboard = async (req, res) => {
  try {
    const result = await Student.findByGender('Female', 1, 50);
    const stats = await Student.getStats();
    res.render('dashboards/female-host', {
      students: result.students,
      stats,
      user: req.user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
};

const getAccountantDashboard = async (req, res) => {
  try {
    const stats = await Student.getStats();
    res.render('dashboards/accountant', {
      stats,
      user: req.user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
};

// Registra Dashboard - Full access (can register students, allocate rooms, manage everything)
const getRegistraDashboard = async (req, res) => {
  try {
    const result = await Student.findAll(1, 50);
    const studentStats = await Student.getStats();
    const roomStats = await Room.getStats();
    res.render('dashboards/registra', {
      students: result.students,
      studentStats,
      roomStats,
      user: req.user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
};

// Matron Dashboard - View only (can only view registered students)
const getMatronDashboard = async (req, res) => {
  try {
    const result = await Student.findAll(1, 50);
    const studentStats = await Student.getStats();
    res.render('dashboards/matron', {
      students: result.students,
      studentStats,
      user: req.user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
};

// Registra can view students by gender with full functionality
const getRegistraMaleStudents = async (req, res) => {
  try {
    const result = await Student.findByGender('Male', 1, 50);
    const stats = await Student.getStats();
    const rooms = await Room.findAvailable('Male');
    res.render('dashboards/registra-male', {
      students: result.students,
      stats,
      rooms,
      user: req.user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
};

const getRegistraFemaleStudents = async (req, res) => {
  try {
    const result = await Student.findByGender('Female', 1, 50);
    const stats = await Student.getStats();
    const rooms = await Room.findAvailable('Female');
    res.render('dashboards/registra-female', {
      students: result.students,
      stats,
      rooms,
      user: req.user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
};

module.exports = {
  getMaleHostDashboard,
  getFemaleHostDashboard,
  getAccountantDashboard,
  getRegistraDashboard,
  getMatronDashboard,
  getRegistraMaleStudents,
  getRegistraFemaleStudents
};

