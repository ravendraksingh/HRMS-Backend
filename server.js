/**
 * HRMS Backend Server
 * Main application entry point
 */

// ============================================================================
// 1. Environment Configuration
// ============================================================================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const pool = require("./db");
const { format } = require("date-fns");
const { connectRedis, disconnectRedis } = require("./util/redisClient");
const { prefillCache } = require("./util/prefillCache");
// ============================================================================
// 2. Application Setup
// ============================================================================
const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || "development";

// Disable ETag for consistent responses
app.set("etag", false);

// ============================================================================
// 3. Middleware Configuration
// ============================================================================

// Body parsing middleware (must be before routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// HTTP request logger (disabled by default)
// Uncomment to enable:
const morgan = require("morgan");
// app.use(morgan(":date :method :url :status :response-time ms"));
// app.use(morgan("dev"));
app.use(morgan(':date[web] :method :url :status :response-time ms'));
morgan.token("date", (req, res) => {
  return format(new Date(), "yyyy-MM-dd HH:mm:ss");
});

// Request payload logger (disabled by default)
// Uncomment to enable:
// const { requestLogger } = require("./middlewares/requestLogger");
// app.use(requestLogger);

// Compression middleware for large payload routes
// Configure compression for calendar and attendance routes
const compress = compression({
  threshold: 1024, // Only compress responses > 1KB
  level: 6, // Balance between compression ratio and CPU usage
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use default compression filter
    return compression.filter(req, res);
  }
});

// Apply compression to specific calendar routes
app.use('/employees/:empid/calendar', compress);
app.use('/employees/:empid/calendar/attendance/monthly', compress);

// ============================================================================
// 4. Route Imports (Organized by Category)
// ============================================================================

// Authentication & Status (Public routes - no auth required)
const authRoutes = require("./routes/auth/auth");
const statusRoutes = require("./routes/status/status");

// Organization & Setup
const organizationRoutes = require("./routes/organization/organization");
const organizationLocationsRoutes = require("./routes/organization/locations");
const financialYearsRoutes = require("./routes/organization/financialYears");

// Employee Routes (must be in specific order to avoid route conflicts)
const employeeSearchRoutes = require("./routes/employees/search");
const employeeCalendarRoutes = require("./routes/employees/calendar");
const employeeAttendanceRoutes = require("./routes/employees/attendance");
const employeeHolidaysRoutes = require("./routes/employees/holidays");
const employeePersonalRoutes = require("./routes/employees/personal");
const employeeEducationRoutes = require("./routes/employees/education");
const employeeEmploymentHistoryRoutes = require("./routes/employees/employmentHistory");
const employeeFamilyRoutes = require("./routes/employees/family");
const employeeJobInfoRoutes = require("./routes/employees/jobInformation");
const employeeLeavesRoutes = require("./routes/employees/leaves");
const employeeRoutes = require("./routes/employees/employees");

// Department Routes
const departmentRoutes = require("./routes/departments/departments");
const departmentHrManagersRoutes = require("./routes/departments/hrManagers");

// Manager Routes
const managerRoutes = require("./routes/managers/managers");
const managerEmployeeLeavesRoutes = require("./routes/managers/employeeLeaves");
const managerEmployeeAttendanceRoutes = require("./routes/managers/employeeAttendance");

// Attendance Routes (must be in specific order)
const attendanceShiftRoutes = require("./routes/attendance/shifts");
const attendanceShiftAssignRoutes = require("./routes/attendance/shiftAssignments");
const attendancePolicyRoutes = require("./routes/attendance/policies");
const attendanceWeeklyOffRoutes = require("./routes/attendance/weeklyOff");
const attendanceCorrectionsRoutes = require("./routes/attendance/corrections");
const attendanceOvertimeRoutes = require("./routes/attendance/overtime");
const attendanceRoutes = require("./routes/attendance/attendance");
const attendanceReportRoutes = require("./routes/attendance/reports");

// Calendar & Holidays
const calendarRoutes = require("./routes/calendar/calendars");
const holidayRoutes = require("./routes/calendar/holidays");

// Leaves
const leaveRoutes = require("./routes/leaves/leaves");
const leaveTypesRoutes = require("./routes/leaves/leaveTypes");

// User Management
const usersRoutes = require("./routes/users/users");
const rolesRoutes = require("./routes/users/roles");

// Admin & Onboarding
const adminRoutes = require("./routes/admin/employees");
const onboardingRoutes = require("./routes/onboarding/onboarding");

// Error Handlers
const { errorHandler } = require("./middlewares/errorHandler");
const { notFoundHandler } = require("./middlewares/notFoundHandler");

// Authentication Middleware
const { authenticateJWT } = require("./middlewares/authenticateJWT");

// ============================================================================
// 5. Route Registration
// ============================================================================

// Public routes (no authentication required)
app.use("/status", statusRoutes);
app.use("/auth", authRoutes);

// Protected routes (require authentication)
app.use(authenticateJWT);

// Organization routes
app.use("/organization", organizationRoutes);
app.use("/financial-years", financialYearsRoutes);
app.use("/locations", organizationLocationsRoutes);

// Employee routes (order matters - specific routes before generic)
app.use("/employees", employeeSearchRoutes);
app.use("/employees", employeeCalendarRoutes);
app.use("/employees", employeeAttendanceRoutes);
app.use("/employees", employeeHolidaysRoutes);
app.use("/employees", employeePersonalRoutes);
app.use("/employees", employeeEducationRoutes);
app.use("/employees", employeeEmploymentHistoryRoutes);
app.use("/employees", employeeFamilyRoutes);
app.use("/employees", employeeJobInfoRoutes);
app.use("/employees", employeeLeavesRoutes);
app.use("/employees", employeeRoutes);

// Department routes
app.use("/departments", departmentRoutes);
app.use("/departments", departmentHrManagersRoutes);

// Manager routes
app.use("/managers", managerRoutes);
app.use("/managers", managerEmployeeLeavesRoutes);
app.use("/managers", managerEmployeeAttendanceRoutes);

// Attendance routes (order matters - specific routes before generic)
app.use("/attendance/shifts", attendanceShiftRoutes);
app.use("/attendance/shift-assignments", attendanceShiftAssignRoutes);
app.use("/attendance/policies", attendancePolicyRoutes);
app.use("/attendance/weekly-off", attendanceWeeklyOffRoutes);
app.use("/attendance/corrections", attendanceCorrectionsRoutes);
app.use("/attendance/overtime", attendanceOvertimeRoutes);
app.use("/attendance", attendanceRoutes);

// Calendar & Holidays
app.use("/calendars", calendarRoutes);
app.use("/holidays", holidayRoutes);

// Leaves
app.use("/leaves", leaveRoutes);
app.use("/leave-types", leaveTypesRoutes);

// Reports
app.use("/reports", attendanceReportRoutes);

// User Management
app.use("/users", usersRoutes);
app.use("/roles", rolesRoutes);

// Admin & Onboarding
app.use("/admin", adminRoutes);
app.use("/onboarding", onboardingRoutes);

// Error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// 6. Database Connection Check
// ============================================================================

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error("Database connection test failed:", error.message);
    return false;
  }
}

// ============================================================================
// 7. Server Initialization
// ============================================================================

/**
 * Start the server
 * @param {boolean} requireDb - If true, server won't start without DB connection
 */
async function startServer(requireDb = true) {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();

    if (requireDb && !dbConnected) {
      console.error(
        "❌ Database connection failed. Server cannot start without database."
      );
      console.error(
        "   Please check your database configuration and ensure MySQL is running."
      );
      process.exit(1);
    }

    if (!dbConnected) {
      console.warn(
        "⚠️  Database connection failed, but server is starting anyway (development mode)."
      );
      console.warn(
        "   Some endpoints may not work until database is available."
      );
    } else {
      console.log("✅ Database connection established");
    }

    // Connect to Redis (non-blocking)
    await connectRedis();

    // Pre-fill cache with frequently accessed, rarely changing data
    if (dbConnected) {
      try {
        await prefillCache();
      } catch (error) {
        console.warn("⚠️  Cache pre-fill failed, but continuing server startup:", error.message);
      }
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log(`📦 Environment: ${NODE_ENV}`);
      console.log(`🌐 Base URL: http://localhost:${PORT}`);
      if (!dbConnected) {
        console.log(`⚠️  Database: Not connected`);
      }
    });

    // Graceful shutdown handling
    setupGracefulShutdown(server);

    return server;
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

// ============================================================================
// 8. Graceful Shutdown
// ============================================================================

/**
 * Setup graceful shutdown handlers
 * @param {http.Server} server - Express server instance
 */
function setupGracefulShutdown(server) {
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Stop accepting new requests
    server.close(async () => {
      console.log("✅ HTTP server closed");

      // Close Redis connection
      await disconnectRedis();

      // Close database pool
      pool.end((err) => {
        if (err) {
          console.error("❌ Error closing database pool:", err.message);
          process.exit(1);
        } else {
          console.log("✅ Database pool closed");
          console.log("👋 Graceful shutdown complete");
          process.exit(0);
        }
      });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error("❌ Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  // Handle termination signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("unhandledRejection");
  });
}

// ============================================================================
// 9. Start Server
// ============================================================================

// Determine if DB connection is required based on environment
// In production, always require DB. In development, make it optional.
const requireDatabase =
  NODE_ENV === "production" ||
  process.env.REQUIRE_DB === "true" ||
  process.env.REQUIRE_DB === "1";

// Start the server
startServer(requireDatabase).catch((error) => {
  console.error("❌ Fatal error during server startup:", error);
  process.exit(1);
});
