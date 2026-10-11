const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createRoom,
  getAllRooms,
  getAvailableRooms,
  updateRoom,
  deleteRoom,
  getRoomStats
} = require('../controllers/roomController');

// Room management - restricted to Registra only
router.post('/', authenticate, authorize('Registra'), createRoom);
router.get('/', authenticate, getAllRooms); // View available to all
router.get('/available', authenticate, getAvailableRooms); // View available to all
router.put('/:id', authenticate, authorize('Registra'), updateRoom);
router.delete('/:id', authenticate, authorize('Registra'), deleteRoom);
router.get('/stats', authenticate, getRoomStats); // View available to all

module.exports = router;

