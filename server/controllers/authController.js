const Admin = require('../models/admin');
const { generateToken } = require('../config/jwt');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.findByUsername(username);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await Admin.verifyPassword(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: admin.id,
      username: admin.username,
      role: admin.role
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Redirect based on role
    const roleRoutes = {
      'Male Host Awardee': '/dashboard/male-host',
      'Female Host Awardee': '/dashboard/female-host',
      'Accountant': '/dashboard/accountant',
      'Registra': '/dashboard/registra',
      'Matron': '/dashboard/matron'
    };

    res.json({
      success: true,
      redirect: roleRoutes[admin.role] || '/dashboard'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
};

const resetPassword = async (req, res) => {
  try {
    const { adminId, newPassword, currentPassword } = req.body;

    if (!adminId || !newPassword) {
      return res.status(400).json({ error: 'Admin ID and new password are required' });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // If resetting own password, require current password
    if (parseInt(adminId) === parseInt(req.user.id)) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change your own password' });
      }

      const admin = await Admin.findById(req.user.id);
      if (!admin) {
        return res.status(401).json({ error: 'Admin not found' });
      }

      const fullAdmin = await Admin.findByUsername(admin.username);
      const isValidPassword = await Admin.verifyPassword(currentPassword, fullAdmin.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    // Update the password
    await Admin.updatePassword(adminId, newPassword);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.getAll();
    res.json({ success: true, admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  login,
  logout,
  resetPassword,
  getAllAdmins
};

