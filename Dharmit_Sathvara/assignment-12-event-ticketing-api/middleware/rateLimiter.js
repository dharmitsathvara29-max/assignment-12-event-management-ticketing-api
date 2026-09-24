const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for the ticket booking endpoint.
 * Allows max 10 booking requests per minute per authenticated user (keyed by user ID).
 * Falls back to IP address if user is not authenticated.
 *
 * Designed to prevent ticket-scalping bots and DDoS abuse on the booking route.
 * Applied ONLY to POST /api/tickets/book.
 */
const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10,             // max 10 requests per windowMs
  keyGenerator: (req) => {
    // Key by authenticated user ID for accurate per-user limiting;
    // fall back to IP if user is somehow not set
    return (req.user && req.user.id) ? req.user.id : req.ip;
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many booking requests, slow down.',
    });
  },
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  skipSuccessfulRequests: false,
});

module.exports = { bookingRateLimiter };
