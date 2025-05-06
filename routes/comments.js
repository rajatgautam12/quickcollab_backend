const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Task = require('../models/Task');
const User = require('../models/User');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Get comments for a task
router.get('/', async (req, res) => {
  try {
    const taskId = req.query.taskId;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID format' });
    }
    const comments = await Comment.find({ task: taskId })
      .populate('user', 'email name')
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
    const { content, taskId, userId } = req.body;

    // Validate input
    if (!content || typeof content !== 'string' || content.trim() === '') {
      console.error('Invalid comment content:', { content });
      return res.status(400).json({ message: 'Comment content is required and must be a non-empty string' });
    }
    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      console.error('Invalid task ID:', { taskId });
      return res.status(400).json({ message: 'Invalid task ID format' });
    }
    if (!req.user?._id || !mongoose.Types.ObjectId.isValid(req.user._id)) {
      console.error('Invalid user authentication:', { userId: req.user?._id, reqUser: req.user });
      return res.status(401).json({ message: 'Invalid or missing user authentication' });
    }
    if (userId && userId !== req.user._id.toString()) {
      console.error('User ID mismatch:', { provided: userId, expected: req.user._id });
      return res.status(403).json({ message: 'User ID in payload does not match authenticated user' });
    }

    // Check if task exists
    const task = await Task.findById(taskId);
    if (!task) {
      console.error('Task not found:', { taskId });
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user exists
    const user = await User.findById(req.user._id);
    if (!user) {
      console.error('User not found:', { userId: req.user._id });
      return res.status(404).json({ message: 'User not found' });
    }

    const comment = new Comment({
      content: content.trim(),
      task: taskId,
      user: req.user._id,
    });

    const newComment = await comment.save();
    const populatedComment = await Comment.findById(newComment._id).populate('user', 'email name');
    const io = req.app.get('io');
    io.to(`task:${taskId}`).emit('commentAdded', populatedComment);
    console.log('Comment created and emitted:', { commentId: newComment._id, taskId });
    res.status(201).json(populatedComment);
  } catch (err) {
    console.error('Error creating comment:', {
      error: err.message,
      stack: err.stack,
      payload: req.body,
      userId: req.user?._id,
    });
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: `Validation error: ${err.message}` });
    }
    res.status(500).json({ message: 'Server error while creating comment' });
  }
});

module.exports = router;