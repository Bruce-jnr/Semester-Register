const Room = require('../models/room');

const createRoom = async (req, res) => {
  try {
    const { room_number, gender_type, capacity } = req.body;

    if (!room_number || !gender_type || !capacity) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!Number.isInteger(Number(capacity)) || Number(capacity) <= 0) {
      return res.status(400).json({ error: 'Capacity must be greater than 0' });
    }

    const roomId = await Room.create({ room_number, gender_type, capacity });
    res.json({ success: true, message: 'Room created successfully', roomId });
  } catch (error) {
    console.error('Room creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Room number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.findAll();
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getAvailableRooms = async (req, res) => {
  try {
    const { gender_type } = req.query;
    if (!gender_type) {
      return res.status(400).json({ error: 'Gender type is required' });
    }
    const rooms = await Room.findAvailable(gender_type);
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_number, gender_type, capacity } = req.body;

    if (!room_number || !gender_type || !capacity) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    await Room.update(id, { room_number, gender_type, capacity });
    res.json({ success: true, message: 'Room updated successfully' });
  } catch (error) {
    console.error('Room update error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    await Room.delete(id);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Room deletion error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

const getRoomStats = async (req, res) => {
  try {
    const stats = await Room.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching room stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createRoom,
  getAllRooms,
  getAvailableRooms,
  updateRoom,
  deleteRoom,
  getRoomStats
};

