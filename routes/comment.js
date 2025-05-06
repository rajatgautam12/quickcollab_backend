const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');

// Get comments for a task
router.get('/', async (req, res) => {
  try {
    const comments = await Comment.find({ task: req.query.taskId })
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
    const comment = new Comment({
      content: req.body.content,
      task: req.body.taskId,
      user: req.user.id,
    });
    const newComment = await comment.save();
    const populatedComment = await Comment.findById(newComment._id).populate('user', 'email');
    const io = req.app.get('io');
    io.to(`task:${req.body.taskId}`).emit('commentAdded', populatedComment);
    res.status(201).json(populatedComment);
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(400).json({ message: 'Failed to create comment' });
  }
});

module.exports = router;