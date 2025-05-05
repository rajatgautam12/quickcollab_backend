const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Board = require('../models/Board');
const authMiddleware = require('../middleware/auth');

// Middleware to check board access
const checkBoardAccess = async (req, res, next) => {
  const { boardId } = req.body;
  try {
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }
    if (board.owner.toString() !== req.user && !board.collaborators.includes(req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET tasks for a specific board
router.get('/:boardId', authMiddleware, async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }
    if (board.owner.toString() !== req.user && !board.collaborators.includes(req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const tasks = await Task.find({ board: req.params.boardId });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create a new task
router.post('/', authMiddleware, checkBoardAccess, async (req, res) => {
  const { title, description, status, dueDate, tags, boardId } = req.body;
  if (!title || !boardId) {
    return res.status(400).json({ message: 'Title and boardId are required' });
  }
  try {
    const task = new Task({
      title,
      description,
      status: status || 'To Do',
      dueDate,
      tags,
      board: boardId,
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update a task
router.put('/:id', authMiddleware, async (req, res) => {
  const { title, description, status, dueDate, tags } = req.body;
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const board = await Board.findById(task.board);
    if (board.owner.toString() !== req.user && !board.collaborators.includes(req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    task.title = title || task.title;
    task.description = description || task.description;
    task.status = status || task.status;
    task.dueDate = dueDate || task.dueDate;
    task.tags = tags || task.tags;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a task
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const board = await Board.findById(task.board);
    if (board.owner.toString() !== req.user && !board.collaborators.includes(req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;