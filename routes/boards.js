const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// GET all boards for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const boards = await Board.find({
      $or: [
        { owner: req.user },
        { collaborators: req.user },
      ],
    });
    res.json(boards);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create a new board
router.post('/', authMiddleware, async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }
  try {
    const board = new Board({
      title,
      owner: req.user,
      collaborators: [],
    });
    await board.save();
    await User.findByIdAndUpdate(req.user, { $push: { boards: board._id } });
    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;