const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT from the Authorization: Bearer <token> header.
 * Attaches userId, businessId, and role to the request object so future routes
 * can filter data strictly by businessId (multi-tenant isolation).
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header is provided and formatted properly
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Access denied. Missing or malformed authorization header.',
      });
    }

    // Extract token part after 'Bearer '
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'Access denied. Token not found.',
      });
    }

    // Verify token using our JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user identifiers to req object
    req.userId = decoded.userId;
    req.businessId = decoded.businessId;
    req.userRole = decoded.role;

    // Proceed to next middleware or route handler
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token. Please log in again.',
    });
  }
}

module.exports = authMiddleware;

