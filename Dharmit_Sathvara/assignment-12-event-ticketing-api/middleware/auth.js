const jwt = require('jsonwebtoken');

/**
 * Authentication middleware.
 * Verifies the JWT from the Authorization: Bearer <token> header.
 * Attaches decoded { id, role, email } to req.user on success.
 * Returns 401 if token is missing or invalid.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided. Use Authorization: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Authentication failed.',
    });
  }
};

module.exports = authenticate;
