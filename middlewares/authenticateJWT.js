const { verifyAccessToken } = require("../util/authUtil");
const logger = require("../config/logger");

async function authenticateJWT(req, res, next) {
  let token = null;

  // Try cookies first (for web browsers)
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  // Fall back to Authorization header (for APIs, mobile, Postman)
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts[0] === "Bearer" && parts[1]) {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      error: "Missing access token",
      // code: "MISSING_TOKEN"
    });
  }

  try {
    const decoded = await verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn("JWT authentication failed", {
      error: err.message,
      name: err.name,
    });
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Access token expired",
        //   code: "TOKEN_EXPIRED"
      });
    }
    return res.status(403).json({
      error: "Invalid access token",
      // code: "INVALID_TOKEN"
    });
  }
}

module.exports = { authenticateJWT };
