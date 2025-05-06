const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    // Check if user exists and delete if found
    await User.findOneAndDelete({ email });
    
    // Create new user
    const user = new User({ email, password, name });
    await user.save();
    
    // Verify JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, user: { id: user._id, email, name } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, email, name: user.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (for testing purposes)
router.delete('/delete', async (req, res) => {
  const { email, secret } = req.query;
  if (secret !== process.env.DELETE_SECRET) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  try {
    const user = await User.findOneAndDelete({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;