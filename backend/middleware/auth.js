
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify user token
exports.authMiddleware = async (req, res, next) => {
  try {
    // Extract token from header - support both formats
    let token = req.header('x-auth-token') || req.header('Authorization');
    
    // Handle Bearer token format
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token, authorization denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user from payload - Support both old and new token formats
    const userId = decoded.user?.id || decoded.userId;
    req.user = await User.findOne({ id: userId });
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or user'
      });
    }
    
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'Token is not valid'
    });
  }
};

// Optional auth middleware that doesn't require authentication
exports.optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Extract token from header
    const token = req.header('x-auth-token');
    
    if (!token) {
      // Continue without setting user
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user from payload if available - Support both old and new token formats
    const userId = decoded.user?.id || decoded.userId;
    req.user = await User.findOne({ id: userId });
    
    next();
  } catch (err) {
    // Continue without setting user on error
    next();
  }
};

// Middleware to verify admin role
exports.adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Admin privileges required'
      });
    }
    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Backward compatibility aliases
exports.authenticateToken = exports.authMiddleware;
