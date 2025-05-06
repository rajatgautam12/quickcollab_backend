const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user._id) {
      console.error('User has no _id:', { email, user });
      return res.status(500).json({ message: 'Server error: Invalid user data' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Generated token for login:', { userId: user._id, email, token: token.slice(0, 20) + '...' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Login error:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }
    user = new User({ name, email, password });
    await user.save();
    if (!user._id) {
      console.error('New user has no _id:', { email, user });
      return res.status(500).json({ message: 'Server error: Invalid user data' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Generated token for register:', { userId: user._id, email, token: token.slice(0, 20) + '...' });
    res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Register error:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error' });
  }
});

// Refresh Token
router.post('/refresh', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      console.error('User not found during refresh:', { userId: req.user._id });
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user._id) {
      console.error('User has no _id during refresh:', { email: user.email, user });
      return res.status(500).json({ message: 'Server error: Invalid user data' });
    }
    const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Generated token for refresh:', { userId: user._id, email: user.email, token: newToken.slice(0, 20) + '...' });
    res.json({ token: newToken, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Refresh token error:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;