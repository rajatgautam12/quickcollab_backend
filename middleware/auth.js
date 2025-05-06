const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.error('No token provided in request', { headers: req.headers });
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    console.log('Verifying token:', { token: token.slice(0, 10) + '...' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', { payload: decoded });

    if (!decoded.id) {
      console.error('Token has no valid id:', { decoded, token: token.slice(0, 20) + '...' });
      return res.status(401).json({ message: 'Token is not valid: Missing user ID' });
    }

    // Retry MongoDB query up to 2 times for transient errors
    let user;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        user = await User.findById(decoded.id).select('-password');
        break;
      } catch (dbErr) {
        console.warn(`MongoDB query attempt ${attempt} failed:`, { error: dbErr.message });
        if (attempt === 3) throw dbErr;
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
      }
    }

    if (!user) {
      console.error('User not found for token:', { id: decoded.id, token: token.slice(0, 20) + '...' });
      return res.status(401).json({ message: 'Token is not valid: User not found' });
    }

    req.user = user;
    console.log('Token validated, user ID set:', { userId: user._id, user: { _id: user._id, email: user.email, name: user.name } });
    next();
  } catch (err) {
    let message = 'Token is not valid';
    if (err.name === 'TokenExpiredError') {
      message = 'Token has expired';
    } else if (err.name === 'JsonWebTokenError') {
      message = `Invalid token: ${err.message}`;
    } else if (err.name === 'MongoServerError') {
      message = 'Database error during authentication';
    }
    console.error('Token verification error:', {
      error: err.name,
      message: err.message,
      stack: err.stack,
      token: req.header('Authorization')?.slice(0, 20) + '...',
    });
    res.status(401).json({ message });
  }
};