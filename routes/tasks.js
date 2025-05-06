const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');

// Get tasks for a board (no auth required)
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find({ board: req.query.boardId });
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ message: 'Server error while fetching tasks' });
  }
});

// Create a task
router.post('/', auth, async (req, res) => {
  const task = new Task({
    title: req.body.title,
    description: req.body.description,
    status: req.body.status || 'To Do',
    board: req.body.boardId,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
  });

  try {
    const newTask = await task.save();
    const io = req.app.get('io');
    io.to(`board:${req.body.boardId}`).emit('taskCreated', newTask);
    res.status(201).json(newTask);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(400).json({ message: 'Failed to create task' });
  }
});

// Update a task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    task.title = req.body.title || task.title;
    task.description = req.body.description || task.description;
    task.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : task.dueDate;
    const updatedTask = await task.save();
    const io = req.app.get('io');
    io.to(`board:${task.board}`).emit('taskEdited', updatedTask);
    res.json(updatedTask);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(400).json({ message: 'Failed to update task' });
  }
});

// Delete a task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    await Task.findByIdAndDelete(req.params.id);
    const io = req.app.get('io');
    io.to(`board:${task.board}`).emit('taskDeleted', req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Error deleting task:', {
      error: err.message,
      stack: err.stack,
      taskId: req.params.id,
    });
    res.status(500).json({ message: 'Server error while deleting task' });
  }
});

module.exports = router;