/**
 * Role-based access control middleware factory.
 * Returns middleware that checks req.user.role against the allowed roles.
 *
 * Usage: router.post('/route', authenticate, checkRole('organizer'), handler)
 *        router.get('/route', authenticate, checkRole('organizer', 'attendee'), handler)
 *
 * @param {...string} allowedRoles - One or more roles permitted to access the route.
 * @returns {Function} Express middleware function.
 */
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

module.exports = checkRole;
