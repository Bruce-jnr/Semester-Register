const pool = require('../config/database');

// Lock the student and both affected rooms so accommodation changes are atomic.
async function setAccommodation(studentId, roomId) {
  const nonResidential = roomId === 'non-residential';
  const targetId = nonResidential ? null : Number(roomId);
  if (!Number.isInteger(Number(studentId)) || Number(studentId) <= 0) throw new Error('A valid student ID is required');
  if (!nonResidential && (!Number.isInteger(targetId) || targetId <= 0)) throw new Error('Choose a room or Non-residential');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [students] = await connection.execute('SELECT * FROM students WHERE id = ? FOR UPDATE', [studentId]);
    const student = students[0];
    if (!student) throw new Error('Student not found');
    const ids = [...new Set([targetId, student.room_id].filter(Boolean))].sort((a, b) => a - b);
    const [rooms] = ids.length ? await connection.query('SELECT * FROM rooms WHERE id IN (?) ORDER BY id FOR UPDATE', [ids]) : [[]];
    const room = rooms.find(value => value.id === targetId);
    if (!nonResidential) {
      if (!room || room.gender_type !== student.gender) throw new Error('Choose a room matching the student gender');
      if (student.room_id === targetId) throw new Error('Student is already in this room');
      if (room.current_capacity <= 0) throw new Error('Room is full');
    }
    await connection.execute('UPDATE students SET room_id = ?, is_non_residential = ? WHERE id = ?', [targetId, nonResidential, studentId]);
    if (room) await connection.execute('UPDATE rooms SET current_capacity = current_capacity - 1 WHERE id = ?', [targetId]);
    if (student.room_id) await connection.execute('UPDATE rooms SET current_capacity = LEAST(capacity, current_capacity + 1) WHERE id = ?', [student.room_id]);
    await connection.commit();
    return { student, room, nonResidential };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { setAccommodation };
