const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Board = require('../models/Board');
const authMiddleware = require('../middleware/auth');

// Middleware to check task and board access
const checkTaskAccess = async (req, res, next) => {
  const { taskId } = req.body;
  try {
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const board = await Board.findById(task.board);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }
    if (board.owner.toString() !== req.user && !board.collaborators.includes(req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    req.task = task;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET comments for a specific task
router.get('/:taskId', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const board = await Board.findById(task.board);
    if (board.owner.toString() !== req.user && !board.collaborators.includes(req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const comments = await Comment.find({ task: req.params.taskId }).populate('user', 'name email');
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create a new comment
router.post('/', authMiddleware, checkTaskAccess, async (req, res) => {
  const { content, taskId } = req.body;
  if (!content || !taskId) {
    return res.status(400).json({ message: 'Content and taskId are required' });
  }
  try {
    const comment = new Comment({
      content,
      user: req.user,
      task: taskId,
    });
    await comment.save();
    const populatedComment = await Comment.findById(comment._id).populate('user', 'name email');
    // Emit real-time comment to all clients in the board room
    const io = req.app.get('io');
    io.to(`board:${req.task.board}`).emit('newComment', populatedComment);
    res.status(201).json(populatedComment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;