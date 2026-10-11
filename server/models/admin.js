const pool = require('../config/database');
const bcrypt = require('bcrypt');

class Admin {
  static async findByUsername(username) {
    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT id, username, role FROM admins WHERE id = ?', [id]);
    return rows[0];
  }

  static async create(adminData) {
    const { username, password, role } = adminData;
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    return result.insertId;
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE admins SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );
    return true;
  }

  static async getAll() {
    const [rows] = await pool.execute(
      'SELECT id, username, role, created_at FROM admins ORDER BY username ASC'
    );
    return rows;
  }
}

module.exports = Admin;

