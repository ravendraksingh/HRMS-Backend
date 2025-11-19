const logger = require("../config/logger");

/**
 * Middleware to log POST/PUT/PATCH request payloads
 * Excludes sensitive fields like passwords for security
 */
const requestLogger = (req, res, next) => {
  // Only log POST, PUT, PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Create a copy of the body to avoid mutating the original
    const bodyCopy = { ...req.body };
    
    // List of sensitive fields to mask
    const sensitiveFields = ['password', 'token', 'secret', 'api_key', 'apikey', 'authorization'];
    
    // Mask sensitive fields
    const sanitizedBody = {};
    for (const [key, value] of Object.entries(bodyCopy)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitizedBody[key] = '***REDACTED***';
      } else {
        sanitizedBody[key] = value;
      }
    }
    
    // Log the request details
    logger.debug('Request payload', {
      method: req.method,
      path: req.path,
      payload: sanitizedBody,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      organization_id: req.organizationId || null,
    });
  }
  
  next();
};

module.exports = requestLogger;

