const pool = require('../config/database');
const { normalizeUniformFee } = require('../services/uniform-fee');

class Student {
  static async create(studentData) {
    const { index_number, name, gender, program, level, phone, email, is_non_residential = false, uniform_fee_status = null } = studentData;
    const uniformStatus = normalizeUniformFee(level, uniform_fee_status);
    const [result] = await pool.execute(
      'INSERT INTO students (index_number, name, gender, program, level, phone, email, is_non_residential, uniform_fee_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [index_number, name.trim().toUpperCase(), gender, program, level, phone, email, is_non_residential, uniformStatus]
    );
    return result.insertId;
  }

  static async updateUniformFee(id, status) {
    const student = await this.findById(id);
    if (!student) return null;
    if (!/^(?:level\s*)?100$/i.test(String(student.level).trim())) throw new Error('Uniform fees apply only to Level 100 students');
    const normalized = normalizeUniformFee(student.level, status);
    await pool.execute('UPDATE students SET uniform_fee_status = ? WHERE id = ?', [normalized, id]);
    return normalized;
  }

  static async findAll(page = 1, limit = 50, gender = null, level = null, search = '') {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (pageNum < 1 || limitNum < 1 || limitNum > 500) throw new Error('Invalid pagination');
    const offset = (pageNum - 1) * limitNum;
    
    // Build WHERE clause based on filters
    let whereClause = '';
    const params = [];
    
    if (gender) {
      whereClause += ' WHERE s.gender = ?';
      params.push(gender);
    }
    
    if (level) {
      if (whereClause) {
        whereClause += ' AND s.level = ?';
      } else {
        whereClause += ' WHERE s.level = ?';
      }
      params.push(level);
    }
    
    if (search) {
      whereClause += (whereClause ? ' AND ' : ' WHERE ') + '(s.name LIKE ? OR s.index_number LIKE ? OR s.phone LIKE ?)';
      params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
    }
    // MySQL doesn't support placeholders for LIMIT/OFFSET in prepared statements
    // Using template literals is safe here since values are parsed integers
    const query = `SELECT s.*, r.room_number FROM students s LEFT JOIN rooms r ON s.room_id = r.id${whereClause} ORDER BY s.created_at DESC, s.id DESC LIMIT ${offset}, ${limitNum}`;
    const [rows] = await pool.execute(query, params);
    
    // Get count with same filters
    const countQuery = `SELECT COUNT(*) as total FROM students s${whereClause}`;
    const [countResult] = await pool.execute(countQuery, params);
    
    return {
      students: rows,
      total: countResult[0].total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countResult[0].total / limitNum)
    };
  }

  static async getDistinctLevels() {
    const [rows] = await pool.execute('SELECT DISTINCT level FROM students ORDER BY level ASC');
    return rows.map(row => row.level);
  }

  static async getDistinctRoomNumbers(gender = null) {
    let query = 'SELECT DISTINCT r.room_number FROM students s LEFT JOIN rooms r ON s.room_id = r.id WHERE r.room_number IS NOT NULL';
    const params = [];
    
    if (gender) {
      query += ' AND s.gender = ?';
      params.push(gender);
    }
    
    query += ' ORDER BY r.room_number ASC';
    const [rows] = await pool.execute(query, params);
    return rows.map(row => row.room_number);
  }

  static async findUnallocated(gender = null) {
    let query = 'SELECT * FROM students WHERE room_id IS NULL AND is_non_residential = FALSE';
    const params = [];
    
    if (gender) {
      query += ' AND gender = ?';
      params.push(gender);
    }
    
    query += ' ORDER BY id DESC';
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT s.*, r.room_number FROM students s LEFT JOIN rooms r ON s.room_id = r.id WHERE s.id = ?',
      [id]
    );
    return rows[0];
  }

  static async findByGender(gender, page = 1, limit = 50, level = null, roomNumber = null, search = '') {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (pageNum < 1 || limitNum < 1 || limitNum > 500) throw new Error('Invalid pagination');
    const offset = (pageNum - 1) * limitNum;
    
    // Build WHERE clause based on filters
    let whereClause = ' WHERE s.gender = ?';
    const params = [gender];
    
    if (level) {
      whereClause += ' AND s.level = ?';
      params.push(level);
    }
    
    if (roomNumber) {
      whereClause += ' AND r.room_number = ?';
      params.push(roomNumber);
    }
    
    if (search) {
      whereClause += (whereClause ? ' AND ' : ' WHERE ') + '(s.name LIKE ? OR s.index_number LIKE ? OR s.phone LIKE ?)';
      params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
    }
    const [rows] = await pool.execute(
      `SELECT s.*, r.room_number FROM students s LEFT JOIN rooms r ON s.room_id = r.id${whereClause} ORDER BY s.created_at DESC, s.id DESC LIMIT ${offset}, ${limitNum}`,
      params
    );
    
    // Get count with same filters
    const countQuery = `SELECT COUNT(*) as total FROM students s LEFT JOIN rooms r ON s.room_id = r.id${whereClause}`;
    const [countResult] = await pool.execute(countQuery, params);
    
    return {
      students: rows,
      total: countResult[0].total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countResult[0].total / limitNum)
    };
  }

  static async allocateRoom(studentId, roomId) {
    await pool.execute(
      'UPDATE students SET room_id = ? WHERE id = ?',
      [roomId, studentId]
    );
  }

  static async findAllForExport(gender = null, level = null, search = '') {
    // Build WHERE clause based on filters
    let whereClause = '';
    const params = [];
    
    if (gender) {
      whereClause += ' WHERE s.gender = ?';
      params.push(gender);
    }
    
    if (level) {
      if (whereClause) {
        whereClause += ' AND s.level = ?';
      } else {
        whereClause += ' WHERE s.level = ?';
      }
      params.push(level);
    }
    
    if (search) {
      whereClause += (whereClause ? ' AND ' : ' WHERE ') + '(s.name LIKE ? OR s.index_number LIKE ? OR s.phone LIKE ?)';
      params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
    }
    // Fetch all students matching filters (no pagination)
    const query = `SELECT s.*, r.room_number FROM students s LEFT JOIN rooms r ON s.room_id = r.id${whereClause} ORDER BY s.created_at DESC, s.id DESC`;
    const [rows] = await pool.execute(query, params);
    
    return rows;
  }

  static async findAllByGenderForExport(gender, level = null, roomNumber = null, search = '') {
    // Build WHERE clause based on filters
    let whereClause = ' WHERE s.gender = ?';
    const params = [gender];
    
    if (level) {
      whereClause += ' AND s.level = ?';
      params.push(level);
    }
    
    if (roomNumber) {
      whereClause += ' AND r.room_number = ?';
      params.push(roomNumber);
    }
    
    if (search) {
      whereClause += (whereClause ? ' AND ' : ' WHERE ') + '(s.name LIKE ? OR s.index_number LIKE ? OR s.phone LIKE ?)';
      params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
    }
    // Fetch all students matching filters (no pagination)
    const query = `SELECT s.*, r.room_number FROM students s LEFT JOIN rooms r ON s.room_id = r.id${whereClause} ORDER BY s.created_at DESC, s.id DESC`;
    const [rows] = await pool.execute(query, params);
    
    return rows;
  }

  static async getLevelCounts(gender = null) {
    let query = 'SELECT level, COUNT(*) as count FROM students WHERE level IS NOT NULL';
    const params = [];
    
    if (gender) {
      query += ' AND gender = ?';
      params.push(gender);
    }
    
    query += ' GROUP BY level ORDER BY level ASC';
    const [rows] = await pool.execute(query, params);
    
    return rows.map(row => ({
      level: row.level,
      count: row.count
    }));
  }

  static async getStats(gender = null) {
    let whereClause = '';
    const params = [];
    
    if (gender) {
      whereClause = ' WHERE gender = ?';
      params.push(gender);
    }
    
    const [total] = await pool.execute(`SELECT COUNT(*) as count FROM students${whereClause}`, params);
    
    // For male/female counts, always get all (not filtered by gender parameter)
    // The gender parameter is only for filtering the total and allocated counts
    const [male] = await pool.execute('SELECT COUNT(*) as count FROM students WHERE gender = ?', ['Male']);
    const [female] = await pool.execute('SELECT COUNT(*) as count FROM students WHERE gender = ?', ['Female']);
    
    // Build allocated query with proper AND clause
    let allocatedQuery = 'SELECT COUNT(*) as count FROM students WHERE room_id IS NOT NULL';
    const allocatedParams = [];
    if (gender) {
      allocatedQuery += ' AND gender = ?';
      allocatedParams.push(gender);
    }
    const [allocated] = await pool.execute(allocatedQuery, allocatedParams);
    const [nonResidential] = await pool.execute('SELECT COUNT(*) as count FROM students WHERE is_non_residential = TRUE' + (gender ? ' AND gender = ?' : ''), gender ? [gender] : []);
    
    // Get level counts (filtered by gender if provided)
    const levelCounts = await this.getLevelCounts(gender);
    
    return {
      total: total[0].count,
      male: male[0].count,
      female: female[0].count,
      allocated: allocated[0].count,
      nonResidential: nonResidential[0].count,
      unallocated: total[0].count - allocated[0].count - nonResidential[0].count,
      levelCounts: levelCounts
    };
  }
}

module.exports = Student;

