// routes/auth.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ApiError = require("../../util/ApiError");
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

    // Check if user is active
    if (user.is_active !== "Y") {
      throw new ApiError("User account is inactive", 403);
    }

    // Update last_login timestamp for this user
    const updateQuery =
      "UPDATE users SET last_login = NOW() WHERE username = ?";
    await pool.query(updateQuery, [username]);

    // Fetch employee details
    const [[emp]] = await pool.query(
      "SELECT * FROM employees WHERE empid = ?",
      [user.empid]
    );

    if (!emp) {
      throw new ApiError("Employee not found for this user", 404);
    }

    // Fetch user roles
    const [roles] = await pool.query(
      `SELECT r.roleid FROM user_roles ur 
       JOIN roles r ON ur.roleid = r.roleid 
       WHERE ur.empid = ?`,
      [user.empid]
    );

    let userRoles = [];
    if (roles && roles.length > 0) {
      userRoles = roles.map((r) => r.roleid);
    }
    
    // Build comprehensive userDetails object with snake_case
    const userDetails = {
      username: user.username,
      name: emp.name,
      empid: user.empid,
      last_login: user.last_login,
      roles: userRoles || [],   
    };

    // Build JWT payload with essential info (using snake_case for consistency)
    const jwtPayload = {
      username: user.username,
      empid: user.empid,
      roles: userRoles || [],
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
       (empid, token, expires_at) 
       VALUES (?, ?, ?)`,
      [user.empid, hashedRefreshToken, expiresAt]
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
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  const { empid, username, password, is_active } = req.body;
  try {
    // Validate required fields
    if (!empid || !username || !password) {
      throw new ApiError("empid, username, and password are required", 400);
    }

    // Hash the password with salt rounds (10 is a good default)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user with hashed password in the database
    const query =
      "INSERT INTO users (empid, username, password, is_active) VALUES (?, ?, ?, ?)";
    const params = [empid, username, hashedPassword, is_active || "N"];
    await pool.query(query, params);

    res
      .status(201)
      .json({ success: true, message: "User registered successfully" });
  } catch (error) {
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
    next(error);
  }
});

router.get("/users/:empid", async (req, res, next) => {
  const empid = req.params.empid;
  try {
    const query = "SELECT * FROM users WHERE empid = ?";
    const [[user]] = await pool.query(query, [empid]);

    if (!user) {
      throw new ApiError("User not found", 404);
    }

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
      `SELECT rt.empid, u.username, u.is_active
         FROM refresh_tokens rt
         INNER JOIN users u ON rt.empid = u.empid
         WHERE rt.token = ? 
           AND rt.revoked_at IS NULL 
           AND rt.expires_at > NOW()
           AND u.is_active = 'Y'`,
      [hashedToken]
    );

    if (!tokenRecord) {
      return next(new ApiError("Invalid or expired refresh token", 401));
    }

    // Fetch user details again (in case roles changed)
    const [[user]] = await pool.query(
      "SELECT * FROM users WHERE empid = ? AND is_active = 'Y'",
      [tokenRecord.empid]
    );

    if (!user) {
      return next(new ApiError("User not found or inactive", 404));
    }

    // Fetch employee details
    const [[emp]] = await pool.query(
      "SELECT * FROM employees WHERE empid = ?",
      [user.empid]
    );

    if (!emp) {
      return next(new ApiError("Employee not found for this user", 404));
    }

    // Fetch user roles
    const [roles] = await pool.query(
      `SELECT r.roleid FROM user_roles ur 
         JOIN roles r ON ur.roleid = r.roleid 
         WHERE ur.empid = ?`,
      [user.empid]
    );

    // Generate new access token with updated user info
    const jwtPayload = {
      username: user.username,
      empid: user.empid,
      roles: roles ? roles.map((r) => r.roleid) : [],
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
