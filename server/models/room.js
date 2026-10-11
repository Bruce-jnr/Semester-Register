const pool = require('../config/database');

class Room {
  static async create(roomData) {
    const { room_number, gender_type, capacity } = roomData;
    const [result] = await pool.execute(
      'INSERT INTO rooms (room_number, gender_type, capacity, current_capacity) VALUES (?, ?, ?, ?)',
      [room_number, gender_type, capacity, capacity]
    );
    return result.insertId;
  }

  static async findAll() {
    const [rows] = await pool.execute('SELECT * FROM rooms ORDER BY room_number');
    return rows;
  }

  static async findAvailable(genderType) {
    const [rows] = await pool.execute(
      'SELECT * FROM rooms WHERE gender_type = ? AND current_capacity > 0 ORDER BY room_number',
      [genderType]
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM rooms WHERE id = ?', [id]);
    return rows[0];
  }

  static async update(id, roomData) {
    const { room_number, gender_type, capacity } = roomData;
    // Get current room data
    const room = await this.findById(id);
    if (!room) {
      throw new Error('Room not found');
    }
    
    const nextCapacity = Number(capacity);
    if (!Number.isInteger(nextCapacity) || nextCapacity <= 0) throw new Error('Capacity must be a positive whole number');
    const occupied = room.capacity - room.current_capacity;
    if (nextCapacity < occupied) throw new Error('Capacity cannot be smaller than the occupied beds');
    if (occupied && gender_type !== room.gender_type) throw new Error('Cannot change gender while students occupy this room');
    // Calculate new current_capacity
    // If capacity increased, increase current_capacity by the same amount
    // If capacity decreased, decrease current_capacity but not below 0
    const capacityDiff = capacity - room.capacity;
    let newCurrentCapacity = room.current_capacity + capacityDiff;
    if (newCurrentCapacity < 0) {
      newCurrentCapacity = 0;
    }
    if (newCurrentCapacity > capacity) {
      newCurrentCapacity = capacity;
    }
    
    await pool.execute(
      'UPDATE rooms SET room_number = ?, gender_type = ?, capacity = ?, current_capacity = ? WHERE id = ?',
      [room_number, gender_type, capacity, newCurrentCapacity, id]
    );
  }

  static async delete(id) {
    const [assigned] = await pool.execute('SELECT COUNT(*) AS count FROM students WHERE room_id = ?', [id]);
    if (assigned[0].count) throw new Error('Move allocated students before deleting this room');
    await pool.execute('DELETE FROM rooms WHERE id = ?', [id]);
  }

  static async decreaseCapacity(id) {
    await pool.execute(
      'UPDATE rooms SET current_capacity = current_capacity - 1 WHERE id = ? AND current_capacity > 0',
      [id]
    );
  }

  static async getStats() {
    const [total] = await pool.execute('SELECT COUNT(*) as count FROM rooms');
    const [available] = await pool.execute('SELECT COUNT(*) as count FROM rooms WHERE current_capacity > 0');
    const [full] = await pool.execute('SELECT COUNT(*) as count FROM rooms WHERE current_capacity = 0');
    
    return {
      total: total[0].count,
      available: available[0].count,
      full: full[0].count
    };
  }
}

module.exports = Room;

