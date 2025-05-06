const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) {
      console.error('JWT missing id field:', decoded);
      return res.status(401).json({ message: 'Invalid token payload' });
    }
    req.user = { id: decoded.id };
    next();
  } catch (err) {
    console.error('Token verification error:', { message: err.message, token });
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = authMiddleware;