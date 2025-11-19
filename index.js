// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const pool = require("./db");
const cors = require("cors");
const morgan = require("morgan");
const app = express();
const cookieParser = require("cookie-parser");
const logger = require("./config/logger");

const requestLogger = require("./middlewares/requestLogger");
const { authenticateJWT } = require("./middlewares/authenticateJWT");
const { requireAdminRole } = require("./util/authUtil");

app.set("etag", false);
// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000", // your Next.js frontend
    credentials: true,
  })
);

// HTTP request logger - use Winston stream for logging
app.use(morgan("combined", { stream: logger.stream }));

// Request payload logger - logs POST/PUT/PATCH request bodies
// Must be after express.json() middleware to access req.body
app.use(requestLogger);

const authRoutes = require("./routes/auth/auth");
const employeeRoutes = require("./routes/employees/employees");
const departmentRoutes = require("./routes/departments/departments");
const departmentHrManagersRoutes = require("./routes/departments/hrManagers");
const managerRoutes = require("./routes/managers/managers");
const adminRoutes = require("./routes/admin/employees");
const attendanceRoutes = require("./routes/attendance/attendance");
const attendanceShiftRoutes = require("./routes/attendance/shifts");
const attendanceShiftAssignRoutes = require("./routes/attendance/shiftAssignments");
const attendancePolicyRoutes = require("./routes/attendance/policies");
const attendanceHolidayRoutes = require("./routes/attendance/holidays");
const attendanceLeaveRoutes = require("./routes/attendance/leaves");
const attendanceOvertimeRoutes = require("./routes/attendance/overtime");
const attendanceReportRoutes = require("./routes/attendance/reports");
const attendanceWeeklyOffRoutes = require("./routes/attendance/weeklyOff");
const employeePersonalRoutes = require("./routes/employees/personal");
const employeeEducationRoutes = require("./routes/employees/education");
const employeeEmploymentHistoryRoutes = require("./routes/employees/employmentHistory");
const employeeFamilyRoutes = require("./routes/employees/family");
const organizationLocationsRoutes = require("./routes/organization/locations");
const organizationsRoutes = require("./routes/organizations/organizations");
const usersRoutes = require("./routes/users/users");
const rolesRoutes = require("./routes/users/roles");
const onboardingRoutes = require("./routes/onboarding/onboarding");
const statusRoutes = require("./routes/status/status");
const { errorHandler } = require("./middlewares/errorHandler");
const { extractOrganizationId } = require("./middlewares/organization");
const { notFoundHandler } = require("./middlewares/notFoundHandler");

const PORT = process.env.PORT || 8080;

// Attach routes
// Status/health check routes (public, no authentication required)
app.use("/status", statusRoutes);
app.use("/auth", authRoutes);

// Public routes (no authentication or organization context required)
app.use("/organizations", organizationsRoutes);
// Apply organization middleware to all routes except auth and public routes

app.use(authenticateJWT);
app.use("/employees", extractOrganizationId, employeeRoutes);
app.use("/departments", extractOrganizationId, departmentRoutes);
app.use("/departments", extractOrganizationId, departmentHrManagersRoutes);
app.use("/managers", extractOrganizationId, managerRoutes);
// Register more specific attendance routes BEFORE the general /attendance route
// This prevents /attendance/shifts from being matched by /attendance/:id
app.use("/attendance/shifts", extractOrganizationId, attendanceShiftRoutes);
app.use("/attendance/policies", extractOrganizationId, attendancePolicyRoutes);
app.use(
  "/attendance/weekly-off",
  extractOrganizationId,
  attendanceWeeklyOffRoutes
);
app.use("/attendance", extractOrganizationId, attendanceRoutes);
app.use("/", extractOrganizationId, attendanceShiftAssignRoutes);
app.use("/holidays", extractOrganizationId, attendanceHolidayRoutes);
app.use("/leaves", extractOrganizationId, attendanceLeaveRoutes);
app.use("/overtime", extractOrganizationId, attendanceOvertimeRoutes);
app.use("/reports", extractOrganizationId, attendanceReportRoutes);
app.use("/", extractOrganizationId, employeePersonalRoutes);
app.use("/", extractOrganizationId, employeeEducationRoutes);
app.use("/", extractOrganizationId, employeeEmploymentHistoryRoutes);
app.use("/", extractOrganizationId, employeeFamilyRoutes);
app.use("/locations", extractOrganizationId, organizationLocationsRoutes);
app.use("/users", extractOrganizationId, usersRoutes);
app.use("/roles", extractOrganizationId, rolesRoutes);
app.use("/onboarding", extractOrganizationId, onboardingRoutes);
app.use("/admin", extractOrganizationId, adminRoutes);
app.use(notFoundHandler);
// Error handler - Must be last
app.use(errorHandler);

(async function initializeServer() {
  try {
    // Test DB connection before starting server
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    logger.info("Connected to MySQL database", {
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "ems",
    });

    // Only start server after successful DB connection
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
      });
    });
  } catch (error) {
    logger.error("Unable to connect to MySQL database", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1); // Exit process if DB connection fails
  }
})();
