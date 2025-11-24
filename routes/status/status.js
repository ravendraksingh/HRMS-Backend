// routes/status/status.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");

/**
 * GET /status
 * Health check endpoint to verify database connectivity
 * Returns: { status: "ok" | "error", database: "connected" | "disconnected", timestamp: string }
 */
router.get("/", async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    // Test database connection
    const connection = await pool.getConnection();

    // Ping the database to verify connection
    await connection.ping();

    // Release the connection back to the pool
    connection.release();

    // If we get here, database is connected
    res.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: timestamp,
      message: "Service is healthy and database is connected",
    });
  } catch (error) {
    // Database connection failed
    res.status(503).json({
      status: "error",
      database: "disconnected",
      timestamp: timestamp,
      message: "Database connection failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * GET /status/detailed
 * Detailed health check with more information
 * Returns: { status, database, server, timestamp, uptime }
 */
router.get("/detailed", async (req, res) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  try {
    // Test database connection
    const connection = await pool.getConnection();
    await connection.ping();

    // Get database info
    const [[dbInfo]] = await connection.query(
      "SELECT VERSION() as version, DATABASE() as `database`"
    );

    connection.release();

    res.status(200).json({
      status: "ok",
      database: {
        connected: true,
        version: dbInfo.version,
        database: dbInfo.database,
      },
      server: {
        uptime: `${Math.floor(uptime)}s`,
        environment: process.env.NODE_ENV || "development",
        node_version: process.version,
      },
      timestamp: timestamp,
      message: "Service is healthy",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: {
        connected: false,
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Connection failed",
      },
      server: {
        uptime: `${Math.floor(uptime)}s`,
        environment: process.env.NODE_ENV || "development",
        node_version: process.version,
      },
      timestamp: timestamp,
      message: "Database connection failed",
    });
  }
});

module.exports = router;
