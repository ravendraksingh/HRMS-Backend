/**
 * Middleware to set HTTP cache headers for browser caching
 * @param {Object} options - Cache configuration
 * @param {number} options.maxAge - Max age in seconds (default: 3600)
 * @param {boolean} options.public - Whether response can be cached by public caches (default: true)
 * @param {boolean} options.mustRevalidate - Whether cache must revalidate (default: false)
 * @param {boolean} options.noCache - Whether to disable caching (default: false)
 */
function setCacheHeaders(options = {}) {
  const {
    maxAge = 3600, // 1 hour default
    public: isPublic = true,
    mustRevalidate = false,
    noCache = false,
  } = options;

  return (req, res, next) => {
    // For no-cache, apply to all methods (important for auth routes)
    if (noCache) {
      // Disable caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      return next();
    }

    // For cache headers, only apply to GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Build Cache-Control directive
    const directives = [];
    
    if (isPublic) {
      directives.push('public');
    } else {
      directives.push('private');
    }
    
    directives.push(`max-age=${maxAge}`);
    
    if (mustRevalidate) {
      directives.push('must-revalidate');
    }

    res.set({
      'Cache-Control': directives.join(', '),
      // Optional: Set Expires header as fallback for older browsers
      'Expires': new Date(Date.now() + maxAge * 1000).toUTCString(),
    });

    next();
  };
}

/**
 * Pre-configured cache header middlewares for different use cases
 */
const cacheHeaders = {
  // Long cache for rarely changing data (departments, locations, etc.)
  longCache: setCacheHeaders({ maxAge: 86400, public: true }), // 24 hours
  
  // Medium cache for moderately changing data (organization info, etc.)
  mediumCache: setCacheHeaders({ maxAge: 3600, public: true }), // 1 hour
  
  // Short cache for frequently changing data (employee data, etc.)
  shortCache: setCacheHeaders({ maxAge: 300, public: true }), // 5 minutes
  
  // Private cache for user-specific data
  privateCache: setCacheHeaders({ maxAge: 300, public: false }), // 5 minutes, private
  
  // No cache for sensitive or real-time data
  noCache: setCacheHeaders({ noCache: true }),
  
  // Custom cache with revalidation
  revalidateCache: setCacheHeaders({ maxAge: 3600, mustRevalidate: true }),
};

module.exports = { setCacheHeaders, cacheHeaders };

