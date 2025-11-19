// routes/auth.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ApiError = require("../../util/ApiError");
const logger = require("../../config/logger");
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} = require("../../util/authUtil");

// Get JWT_SECRET from environment variables (required)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. Please set it in your .env file."
  );
}

router.post("/login", async (req, res, next) => {
  const { username, password } = req.body;

  async function verifyPassword(inputPassword, storedHash) {
    const isMatch = await bcrypt.compare(inputPassword, storedHash);
    return isMatch;
  }

  try {
    const [[user]] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (!user) throw new ApiError("Username not found", 404);

    const verified = await verifyPassword(password, user.password);
    if (!verified) throw new ApiError("Invalid credentials", 400);

    // Update last_login timestamp for this user
    const updateQuery =
      "UPDATE users SET last_login = NOW() WHERE username = ?";
    await pool.query(updateQuery, [username]);

    // Fetch employee details
    const [[emp]] = await pool.query("SELECT * FROM employees WHERE id = ?", [
      user.employee_id,
    ]);

    if (!emp) {
      throw new ApiError("Employee not found for this user", 404);
    }

    // Fetch organization details
    const [[org]] = await pool.query(
      "SELECT id, code, name FROM organizations WHERE id = ?",
      [user.organization_id]
    );

    if (!org) {
      throw new ApiError("Organization not found for this user", 404);
    }

    // Fetch user roles
    const [roles] = await pool.query(
      `SELECT r.id, r.name, r.code, r.description 
       FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ?`,
      [user.id]
    );

    // Build comprehensive userDetails object with snake_case
    const userDetails = {
      user_id: user.id,
      username: user.username,
      organization_id: user.organization_id,
      organization_code: org.code,
      organization_name: org.name,
      employee_id: user.employee_id,
      employee_name: emp.name,
      employee_email: emp.email,
      employee_code: emp.employee_code,
      is_active: user.is_active === 1,
      roles: roles.map((r) => ({
        role_name: r.name,
        role_code: r.code,
        // description: r.description,
      })),
      last_login: user.last_login,
    };

    // Build JWT payload with essential info (using snake_case for consistency)
    const jwtPayload = {
      user_id: user.id,
      username: user.username,
      organization_id: user.organization_id,
      organization_code: org.code,
      employee_id: user.employee_id,
      //   employee_code: emp.employee_code,
      roles: roles.map((r) => r.code), // Include role codes in JWT
    };

    // Generate Tokens
    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashRefreshToken(refreshToken);

    // Calculate expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store refresh token in database
    await pool.query(
      `INSERT INTO refresh_tokens 
       (user_id, organization_id, token, device_info, ip_address, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.organization_id,
        hashedRefreshToken,
        req.headers["user-agent"] || null,
        req.ip || req.connection.remoteAddress || null,
        expiresAt,
      ]
    );

    // Set tokens in HTTP-only cookies (secure for production)
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // Only send over HTTPS in production
      sameSite: isProduction ? "strict" : "lax", // CSRF protection
      maxAge: 15 * 60 * 1000, // 15 minutes for access token
    };
    const refreshCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for refresh token
    };

    res.cookie("accessToken", accessToken, cookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken, // Send plain token to client (for non-cookie clients)
      token_type: "Bearer",
      expires_in: 900, // 15 minutes in seconds
      user: userDetails,
    });
  } catch (error) {
    logger.error("Database error during login", {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  const { username, password, employee_id, is_active, role } = req.body;
  try {
    // Hash the password with salt rounds (10 is a good default)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // Insert new user with hashed password in the database
    const query =
      "INSERT INTO users (username, password, is_active, employee_id, role) VALUES (?, ?, ?, ?, ?)";
    const params = [username, hashedPassword, is_active, employee_id, role];
    await pool.query(query, params);

    res
      .status(201)
      .json({ success: true, message: "User registered successfully" });
  } catch (error) {
    logger.error("Registration error", {
      error: error.message,
      stack: error.stack,
      username: username,
    });
    next(error);
  }
});

router.post("/updatePassword", async (req, res, next) => {
  const { username, password } = req.body;
  try {
    // Hash the password with salt rounds (10 is a good default)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const query = "UPDATE users SET password = ? WHERE username = ?";
    const params = [hashedPassword, username];
    await pool.query(query, params);

    res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    logger.error("Password update error", {
      error: error.message,
      stack: error.stack,
      username: username,
    });
    next(error);
  }
});

router.get("/users/:id", async (req, res, next) => {
  const id = req.params.id;
  try {
    const query = "SELECT * FROM users WHERE id = ?";
    const [[user]] = await pool.query(query, [id]);
    logger.debug("User fetched", { user_id: id });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * Body: { refresh_token: string }
 * Returns: { access_token: string, token_type: "Bearer", expires_in: number }
 */
router.post("/refresh", async (req, res, next) => {
  // Try to get refresh token from cookie first, then from body
  let refresh_token = req.cookies?.refreshToken || req.body?.refresh_token;

  if (!refresh_token) {
    return next(new ApiError("Refresh token is required", 400));
  }

  try {
    // Hash the provided refresh token to compare with stored hash
    const hashedToken = hashRefreshToken(refresh_token);

    // Find valid refresh token in database
    const [[tokenRecord]] = await pool.query(
      `SELECT rt.user_id, rt.organization_id, u.username, u.is_active
         FROM refresh_tokens rt
         INNER JOIN users u ON rt.user_id = u.id
         WHERE rt.token = ? 
           AND rt.revoked_at IS NULL 
           AND rt.expires_at > NOW()
           AND u.is_active = 1`,
      [hashedToken]
    );

    if (!tokenRecord) {
      return next(new ApiError("Invalid or expired refresh token", 401));
    }

    // Fetch user details again (in case roles changed)
    const [[user]] = await pool.query(
      "SELECT * FROM users WHERE id = ? AND is_active = 1",
      [tokenRecord.user_id]
    );

    if (!user) {
      return next(new ApiError("User not found or inactive", 404));
    }

    // Fetch employee details
    const [[emp]] = await pool.query("SELECT * FROM employees WHERE id = ?", [
      user.employee_id,
    ]);

    if (!emp) {
      return next(new ApiError("Employee not found for this user", 404));
    }

    // Fetch organization details
    const [[org]] = await pool.query(
      "SELECT id, code, name FROM organizations WHERE id = ?",
      [user.organization_id]
    );

    if (!org) {
      return next(new ApiError("Organization not found for this user", 404));
    }

    // Fetch user roles
    const [roles] = await pool.query(
      `SELECT r.code FROM user_roles ur 
         JOIN roles r ON ur.role_id = r.id 
         WHERE ur.user_id = ?`,
      [user.id]
    );

    // Generate new access token with updated user info
    const jwtPayload = {
      user_id: user.id,
      username: user.username,
      organization_id: user.organization_id,
      organization_code: org.code,
      //   employee_id: user.employee_id,
      //   employee_code: emp.employee_code,
      roles: roles.map((r) => r.code),
    };

    const accessToken = generateAccessToken(jwtPayload);

    // Set new access token in HTTP-only cookie
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
    };

    res.cookie("accessToken", accessToken, cookieOptions);

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 900, // 15 minutes in seconds
    });
  } catch (error) {
    logger.error("Refresh token error", {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  // Try to get refresh token from cookie first, then from body
  let refresh_token = req.cookies?.refreshToken || req.body?.refresh_token;

  if (!refresh_token) {
    return next(new ApiError("Refresh token is required", 400));
  }

  try {
    const hashedToken = hashRefreshToken(refresh_token);

    // Revoke refresh token
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL",
      [hashedToken]
    );

    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
