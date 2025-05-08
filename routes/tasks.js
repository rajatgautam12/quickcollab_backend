const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Board = require('../models/Board');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Middleware to check if user is a board member
const isBoardMember = async (req, res, next) => {
  try {
    let boardId;

    // For GET and POST, boardId comes from query or body
    if (req.method === 'GET') {
      boardId = req.query.boardId;
    } else if (req.method === 'POST') {
      boardId = req.body.boardId;
    } else {
      // For PUT and DELETE, get boardId from the task
      const taskId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({ message: 'Invalid task ID format' });
      }
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      boardId = task.board;
    }

    if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
      console.error('Invalid or missing boardId:', { boardId, method: req.method, url: req.url });
      return res.status(400).json({ message: 'Invalid or missing board ID' });
    }

    const board = await Board.findById(boardId);
    if (!board) {
      console.error('Board not found:', { boardId });
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.owner.toString() !== req.user._id.toString() &&
        !board.collaborators.some(collab => collab.userId.toString() === req.user._id.toString())) {
      console.error('User not authorized for board:', { userId: req.user._id, boardId });
      return res.status(403).json({ message: 'You are not authorized to perform this action' });
    }

    req.board = board; // Attach board to request for later use
    next();
  } catch (err) {
    console.error('Error in isBoardMember middleware:', {
      error: err.message,
      stack: err.stack,
      userId: req.user?._id,
      method: req.method,
      url: req.url
    });
    res.status(500).json({ message: 'Server error in authorization check' });
  }
};

// Get tasks for a board
router.get('/', auth, isBoardMember, async (req, res) => {
  try {
    const tasks = await Task.find({ board: req.query.boardId }).populate('assignedTo', 'email name');
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', {
      error: err.message,
      stack: err.stack,
      boardId: req.query.boardId
    });
    res.status(500).json({ message: 'Server error while fetching tasks' });
  }
});

// Create a task
router.post('/', auth, isBoardMember, async (req, res) => {
  if (!req.body.title || !req.body.boardId) {
    return res.status(400).json({ message: 'Title and boardId are required' });
  }

  const task = new Task({
    title: req.body.title,
    description: req.body.description,
    status: req.body.status || 'To Do',
    board: req.body.boardId,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    assignedTo: req.body.assignedTo || null,
  });

  try {
    const newTask = await task.save();
    const populatedTask = await Task.findById(newTask._id).populate('assignedTo', 'email name');
    const io = req.app.get('io');
    io.to(`board:${req.body.boardId}`).emit('taskCreated', populatedTask);
    if (newTask.assignedTo) {
      io.to(`user:${newTask.assignedTo}`).emit('taskAssigned', populatedTask);
    }
    res.status(201).json(populatedTask);
  } catch (err) {
    console.error('Error creating task:', {
      error: err.message,
      stack: err.stack,
      payload: req.body
    });
    res.status(400).json({ message: 'Failed to create task' });
  }
});

// Update a task
router.put('/:id', auth, isBoardMember, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    task.title = req.body.title || task.title;
    task.description = req.body.description || task.description;
    task.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : task.dueDate;
    task.status = req.body.status || task.status;
    task.assignedTo = req.body.assignedTo || task.assignedTo;
    const updatedTask = await task.save();
    const populatedTask = await Task.findById(updatedTask._id).populate('assignedTo', 'email name');
    const io = req.app.get('io');
    io.to(`board:${task.board}`).emit('taskEdited', populatedTask);
    if (updatedTask.assignedTo) {
      io.to(`user:${updatedTask.assignedTo}`).emit('taskAssigned', populatedTask);
    }
    res.json(populatedTask);
  } catch (err) {
    console.error('Error updating task:', {
      error: err.message,
      stack: err.stack,
      taskId: req.params.id
    });
    res.status(400).json({ message: 'Failed to update task' });
  }
});

// Assign a task to a user
router.put('/:id/assign', auth, isBoardMember, async (req, res) => {
  const { assignedTo } = req.body;

  if (assignedTo && !mongoose.Types.ObjectId.isValid(assignedTo)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (assignedTo) {
      const board = await Board.findById(task.board);
      if (!board.collaborators.some(collab => collab.userId.toString() === assignedTo) &&
          board.owner.toString() !== assignedTo) {
        return res.status(400).json({ message: 'Assigned user must be a board collaborator' });
      }
    }

    task.assignedTo = assignedTo || null;
    const updatedTask = await task.save();
    const populatedTask = await Task.findById(updatedTask._id).populate('assignedTo', 'email name');
    const io = req.app.get('io');
    io.to(`board:${task.board}`).emit('taskAssigned', populatedTask);
    if (assignedTo) {
      io.to(`user:${assignedTo}`).emit('taskAssigned', populatedTask);
    }
    res.json(populatedTask);
  } catch (err) {
    console.error('Error assigning task:', {
      error: err.message,
      stack: err.stack,
      taskId: req.params.id
    });
    res.status(400).json({ message: 'Failed to assign task' });
  }
});

// Delete a task
router.delete('/:id', auth, isBoardMember, async (req, res) => {
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