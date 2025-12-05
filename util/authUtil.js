const jwt = require("jsonwebtoken");
const { SignJWT, jwtVerify, EncryptJWT, jwtDecrypt } = require("jose");
const crypto = require("crypto");
const pool = require("../db");

// Get JWT_SECRET from environment variables (required)
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. Please set it in your .env file."
  );
}

const TOKEN_SECRET = process.env.TOKEN_SECRET;
if (!TOKEN_SECRET) {
  throw new Error(
    "TOKEN_SECRET environment variable is required. Please set it in your .env file."
  );
}
const encodedKey = new TextEncoder().encode(TOKEN_SECRET);

const keyBuffer = crypto.randomBytes(32);
const secretKey = crypto.createSecretKey(keyBuffer);

// Generate access token (short-lived)
function generateAccessToken(payload) {
  //   console.log("ACCESS_TOKEN_EXPIRY:", ACCESS_TOKEN_EXPIRY);
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

// Generate refresh token (long-lived, stored in DB)
function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

// Hash refresh token before storing in DB
function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Verify access token
async function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw error;
  }
}

// Verify refresh token (if you want to sign it with JWT too)
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    throw error;
  }
}

function requireAdminRole(req, res, next) {
  // Check that req.user is present (assumed to be set by authenticateJWT)
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  // Check user's role -- adapt as per your JWT payload!
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  // If OK, move to next handler
  next();
}

/**
 * Middleware to check if user is HR Manager or Admin
 * Checks user roles from database
 */

module.exports = {
  requireAdminRole,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
