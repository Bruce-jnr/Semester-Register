const pool = require('../config/database');

class Fee {
  static async create(feeData) {
    const { index_number, student_name, amount_paid, payment_method, date_paid, receipt_number, level } = feeData;
    // Ensure level is properly handled (convert empty string to null)
    const levelValue = (level && level.trim() !== '') ? level.trim() : null;
    const [result] = await pool.execute(
      'INSERT INTO fees (index_number, student_name, amount_paid, payment_method, date_paid, receipt_number, level, receipt_issued) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)',
      [index_number, student_name, amount_paid, payment_method, date_paid, receipt_number, levelValue]
    );
    return result.insertId;
  }

  static async findAll(level = null, receiptIssued = null, paymentMethod = null, page = 1, limit = 10, sortBy = 'date_paid', sortOrder = 'DESC', search = '') {
    let whereClause = '';
    const params = [];
    
    // Build WHERE clause based on filters
    if (level) {
      whereClause += ' WHERE f.level = ?';
      params.push(level);
    }
    
    if (receiptIssued !== null) {
      if (whereClause) {
        whereClause += ' AND f.receipt_issued = ?';
      } else {
        whereClause += ' WHERE f.receipt_issued = ?';
      }
      params.push(receiptIssued === 'true' || receiptIssued === true || receiptIssued === '1' || receiptIssued === 1);
    }
    
    if (paymentMethod) {
      if (whereClause) {
        whereClause += ' AND f.payment_method = ?';
      } else {
        whereClause += ' WHERE f.payment_method = ?';
      }
      params.push(paymentMethod);
    }
    
    if (search) {
      whereClause += (whereClause ? ' AND ' : ' WHERE ') + '(f.student_name LIKE ? OR f.index_number LIKE ? OR f.receipt_number LIKE ? OR f.college_receipt_number LIKE ?)';
      params.push(...Array(4).fill('%' + search + '%'));
    }
    // Parse page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    // Validate sortBy and sortOrder to prevent SQL injection
    const allowedSortColumns = ['date_paid', 'created_at', 'amount_paid', 'student_name', 'index_number'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'date_paid';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Select all fee columns including level (now stored directly in fees table)
    const query = `SELECT 
                     f.id,
                     f.index_number,
                     f.student_name,
                     f.amount_paid,
                     f.payment_method,
                     f.date_paid,
                     f.receipt_number,
                     f.college_receipt_number,
                     f.receipt_issued,
                     f.receipt_issued_at,
                     f.created_at,
                     f.level
                   FROM fees f
                  ${whereClause}
                  ORDER BY f.${validSortBy} ${validSortOrder}, f.created_at DESC, f.id DESC
                   LIMIT ${offset}, ${limitNum}`;
    
    const [rows] = await pool.execute(query, params);
    
    // Get count with same filters
    const countQuery = `SELECT COUNT(*) as total FROM fees f${whereClause}`;
    const [countResult] = await pool.execute(countQuery, params);
    
    return {
      fees: rows,
      total: countResult[0].total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countResult[0].total / limitNum)
    };
  }

  static async getDistinctLevels() {
    const [rows] = await pool.execute(`
      SELECT DISTINCT level 
      FROM fees 
      WHERE level IS NOT NULL 
      ORDER BY level ASC
    `);
    return rows.map(row => row.level);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM fees WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async findByIndexNumber(index_number) {
    const [rows] = await pool.execute(
      'SELECT * FROM fees WHERE index_number = ? ORDER BY date_paid DESC',
      [index_number]
    );
    return rows;
  }

  static async findByReceiptNumber(receipt_number) {
    const [rows] = await pool.execute(
      'SELECT * FROM fees WHERE receipt_number = ?',
      [receipt_number]
    );
    return rows[0];
  }

  static async markReceiptIssued(id) {
    await pool.execute(
      'UPDATE fees SET receipt_issued = TRUE WHERE id = ?',
      [id]
    );
    return true;
  }

  static async generateAndStoreCollegeReceipt(id) {
    const connection = await pool.getConnection();
    let locked = false;
    try {
      const [lock] = await connection.execute("SELECT GET_LOCK('registra_receipt_sequence', 10) AS acquired");
      locked = lock[0].acquired === 1;
      if (!locked) throw new Error('Receipt service is busy; please try again');
      await connection.beginTransaction();
      const [records] = await connection.execute('SELECT * FROM fees WHERE id = ? FOR UPDATE', [id]);
      if (!records[0]) throw new Error('Payment not found');
      if (records[0].college_receipt_number) { await connection.commit(); return records[0].college_receipt_number; }
      const year = new Date().getFullYear();
      const prefix = 'NSACOE-' + year + '-';
      const [last] = await connection.execute('SELECT college_receipt_number FROM fees WHERE college_receipt_number LIKE ? ORDER BY college_receipt_number DESC LIMIT 1', [prefix + '%']);
      const next = last.length ? Number(last[0].college_receipt_number.split('-')[2]) + 1 : 1;
      const number = prefix + String(next).padStart(6, '0');
      await connection.execute('UPDATE fees SET college_receipt_number = ?, receipt_issued = TRUE, receipt_issued_at = CURRENT_TIMESTAMP WHERE id = ?', [number, id]);
      await connection.commit();
      return number;
    } catch (error) { await connection.rollback(); throw error; }
    finally { if (locked) await connection.execute("SELECT RELEASE_LOCK('registra_receipt_sequence')"); connection.release(); }
  }

  static async findByCollegeReceiptNumber(college_receipt_number) {
    const [rows] = await pool.execute(
      'SELECT * FROM fees WHERE college_receipt_number = ?',
      [college_receipt_number]
    );
    return rows[0];
  }

  static async getStats() {
    const [totalPayments] = await pool.execute('SELECT COUNT(*) as count FROM fees');
    const [totalAmount] = await pool.execute('SELECT SUM(amount_paid) as total FROM fees');
    const [gcbCount] = await pool.execute('SELECT COUNT(*) as count FROM fees WHERE payment_method = ?', ['GCB']);
    const [cbgCount] = await pool.execute('SELECT COUNT(*) as count FROM fees WHERE payment_method = ?', ['CBG']);
    const [cbgUssdCount] = await pool.execute('SELECT COUNT(*) as count FROM fees WHERE payment_method = ?', ['CBG USSD']);
    const [receiptIssuedCount] = await pool.execute('SELECT COUNT(*) as count FROM fees WHERE receipt_issued = TRUE');
    const [receiptPendingCount] = await pool.execute('SELECT COUNT(*) as count FROM fees WHERE receipt_issued = FALSE');
    
    return {
      totalPayments: totalPayments[0].count,
      totalAmount: totalAmount[0].total || 0,
      gcb: gcbCount[0].count,
      cbg: cbgCount[0].count,
      cbgUssd: cbgUssdCount[0].count,
      receiptIssued: receiptIssuedCount[0].count,
      receiptPending: receiptPendingCount[0].count
    };
  }
}

module.exports = Fee;

