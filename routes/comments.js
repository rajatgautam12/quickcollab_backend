const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Get comments for a task
router.get('/', async (req, res) => {
  try {
    const taskId = req.query.taskId;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }
    const comments = await Comment.find({ task: taskId })
      .populate('user', 'email')
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ message: 'Server error while fetching comments' });
  }
});

// Create a comment
router.post('/', auth, async (req, res) => {
  try {
    const { content, taskId } = req.body;

    // Validate input
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ message: 'Comment content is required and must be a non-empty string' });
    }
    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    // Check if task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = new Comment({
      content: content.trim(),
      task: taskId,
      user: req.user.id,
    });

    const newComment = await comment.save();
    const populatedComment = await Comment.findById(newComment._id).populate('user', 'email');
    const io = req.app.get('io');
    io.to(`task:${taskId}`).emit('commentAdded', populatedComment);
    res.status(201).json(populatedComment);
  } catch (err) {
    console.error('Error creating comment:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: `Validation error: ${err.message}` });
    }
    res.status(500).json({ message: 'Server error while creating comment' });
  }
});

module.exports = router;