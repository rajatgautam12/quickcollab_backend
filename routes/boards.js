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
        { owner: req.user._id },
        { 'collaborators.userId': req.user._id },
      ],
    });
    res.json(boards);
  } catch (err) {
    console.error('Error fetching boards:', err);
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
      owner: req.user._id,
      collaborators: [{ userId: req.user._id, email: req.user.email, role: 'Owner' }],
    });
    await board.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { boards: board._id } });
    res.status(201).json(board);
  } catch (err) {
    console.error('Error creating board:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST invite a user to a board
router.post('/:boardId/invite', authMiddleware, async (req, res) => {
  const { email } = req.body;
  const { boardId } = req.params;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the board owner can invite collaborators' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (board.collaborators.some(collab => collab.userId.toString() === user._id.toString())) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    const collaborator = {
      userId: user._id,
      email: user.email,
      role: 'Member',
    };

    board.collaborators.push(collaborator);
    await board.save();
    await User.findByIdAndUpdate(user._id, { $push: { boards: board._id } });

    const io = req.app.get('io');
    io.to(`user:${user._id}`).emit('inviteSent', { boardId, boardTitle: board.title });
    io.to(`board:${boardId}`).emit('collaboratorAdded', collaborator);

    res.status(200).json(collaborator);
  } catch (err) {
    console.error('Error inviting collaborator:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET collaborators for a board
router.get('/:boardId/collaborators', authMiddleware, async (req, res) => {
  const { boardId } = req.params;

  try {
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.owner.toString() !== req.user._id.toString() &&
        !board.collaborators.some(collab => collab.userId.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'You are not authorized to view this board' });
    }

    res.json(board.collaborators);
  } catch (err) {
    console.error('Error fetching collaborators:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;