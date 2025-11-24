// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const pool = require("./db");
const cors = require("cors");
const morgan = require("morgan");
const app = express();
const cookieParser = require("cookie-parser");

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

// HTTP request logger - uses logger stream for logging
// LOGGING DISABLED - Uncomment below to enable logging
// app.use(morgan("combined", { stream: logger.stream }));

// Request payload logger - logs POST/PUT/PATCH request bodies
// Must be after express.json() middleware to access req.body
// LOGGING DISABLED - Uncomment below to enable logging
// app.use(requestLogger);

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
const calendarRoutes = require("./routes/calendar/calendars");
const holidayRoutes = require("./routes/calendar/holidays");
const leaveRoutes = require("./routes/leaves/leaves");
const leaveTypesRoutes = require("./routes/leaves/leaveTypes");
const attendanceCorrectionsRoutes = require("./routes/attendance/corrections");
const attendanceOvertimeRoutes = require("./routes/attendance/overtime");
const attendanceReportRoutes = require("./routes/attendance/reports");
const attendanceWeeklyOffRoutes = require("./routes/attendance/weeklyOff");
const attendanceCalendarRoutes = require("./routes/attendance/attendance-calendar");
const employeePersonalRoutes = require("./routes/employees/personal");
const employeeEducationRoutes = require("./routes/employees/education");
const employeeEmploymentHistoryRoutes = require("./routes/employees/employmentHistory");
const employeeFamilyRoutes = require("./routes/employees/family");
const employeeJobInfoRoutes = require("./routes/employees/jobInformation");
const employeePayrollRoutes = require("./routes/employees/payroll");
const employeeComplianceRoutes = require("./routes/employees/compliance");
const employeeLeavesRoutes = require("./routes/employees/leaves");
const employeeSearchRoutes = require("./routes/employees/search");
const organizationRoutes = require("./routes/organization/organization");
const organizationLocationsRoutes = require("./routes/organization/locations");
const usersRoutes = require("./routes/users/users");
const rolesRoutes = require("./routes/users/roles");
const onboardingRoutes = require("./routes/onboarding/onboarding");
const statusRoutes = require("./routes/status/status");
const { errorHandler } = require("./middlewares/errorHandler");
const { notFoundHandler } = require("./middlewares/notFoundHandler");

const PORT = process.env.PORT || 8080;

// Attach routes
// Status/health check routes (public, no authentication required)
app.use("/status", statusRoutes);
app.use("/auth", authRoutes);

app.use(authenticateJWT);
// Register employee search route BEFORE general employee routes
// This prevents /employees/search from being matched by /employees/:empid
app.use("/employees", employeeSearchRoutes);
app.use("/employees", employeeRoutes);
app.use("/departments", departmentRoutes);
app.use("/departments", departmentHrManagersRoutes);
app.use("/managers", managerRoutes);
// Register more specific attendance routes BEFORE the general /attendance route
// This prevents /attendance/shifts from being matched by /attendance/:id
app.use("/attendance/shifts", attendanceShiftRoutes);
app.use("/attendance/policies", attendancePolicyRoutes);
app.use("/attendance/weekly-off", attendanceWeeklyOffRoutes);
app.use("/attendance/corrections", attendanceCorrectionsRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/attendance-calendar", attendanceCalendarRoutes);
app.use("/", attendanceShiftAssignRoutes);
app.use("/calendars", calendarRoutes);
app.use("/holidays", holidayRoutes);
app.use("/leaves", leaveRoutes);
app.use("/leave-types", leaveTypesRoutes);
app.use("/overtime", attendanceOvertimeRoutes);
app.use("/reports", attendanceReportRoutes);
app.use("/", employeePersonalRoutes);
app.use("/", employeeEducationRoutes);
app.use("/", employeeEmploymentHistoryRoutes);
app.use("/", employeeFamilyRoutes);
app.use("/employees", employeeJobInfoRoutes);
app.use("/employees", employeePayrollRoutes);
app.use("/employees", employeeComplianceRoutes);
app.use("/employees", employeeLeavesRoutes);
app.use("/organizations", organizationRoutes);
app.use("/locations", organizationLocationsRoutes);
app.use("/users", usersRoutes);
app.use("/roles", rolesRoutes);
app.use("/onboarding", onboardingRoutes);
app.use("/admin", adminRoutes);
app.use(notFoundHandler);
// Error handler - Must be last
app.use(errorHandler);

(async function initializeServer() {
  try {
    // Test DB connection before starting server
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    // LOGGING DISABLED
    // logger.info("Connected to MySQL database", {
    //   host: process.env.DB_HOST || "localhost",
    //   database: process.env.DB_NAME || "ems",
    // });

    // Only start server after successful DB connection
    app.listen(PORT, () => {
      // LOGGING DISABLED
      // logger.info(`Server listening on port ${PORT}`, {
      //   port: PORT,
      //   environment: process.env.NODE_ENV || "development",
      // });
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    // LOGGING DISABLED
    // logger.error("Unable to connect to MySQL database", {
    //   error: error.message,
    //   stack: error.stack,
    // });
    console.error("Unable to connect to MySQL database:", error.message);
    process.exit(1); // Exit process if DB connection fails
  }
})();
