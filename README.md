# HRMS Backend

**Human Resource Management System - Backend**

A comprehensive Human Resource Management System (HRMS) backend built with Node.js, Express.js, and MySQL.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication)
  - [Employees](#employees)
  - [Manager Dashboard](#manager-dashboard)
  - [Attendance](#attendance)
  - [Calendars](#calendars)
  - [Leaves](#leaves)
  - [Health Check](#health-check)
- [Environment Variables](#environment-variables)
- [Logging](#logging)
- [Database Design](#database-design)
- [Testing](#testing)
- [Development](#development)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)
- [Support](#support)

## Features

- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Employee Management**: Complete CRUD operations for employees, departments, and locations
- **Attendance Tracking**: Clock in/out, leave management, overtime tracking, and shift management
- **Calendar System**: Hierarchical calendar system (Organization → Location → Department → Employee) with holidays, weekly offs, and date overrides
- **Comprehensive Attendance Calendar**: Combined view of calendar, attendance records, and leaves for each day
- **Manager Dashboard**: Comprehensive team management APIs for managers
- **Role-Based Access Control**: Flexible user roles and permissions
- **Logging**: Logging is currently disabled (no-op logger)
- **RESTful API**: Well-structured REST endpoints following industry best practices

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MySQL 8.0+
- **Authentication**: JWT (JSON Web Tokens)
- **Logging**: Disabled (no-op logger)
- **Password Hashing**: bcrypt

## Prerequisites

- Node.js (v14 or higher)
- MySQL 8.0+
- npm or yarn

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ravendraksingh/HRMS-Backend.git
   cd HRMS-Backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```env
   # JWT Configuration (REQUIRED)
   JWT_SECRET=your_generated_secret_here_minimum_32_characters

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=hrms_backend

   # Server Configuration
   PORT=8080
   NODE_ENV=development

   # Logging (Optional)
   LOG_LEVEL=debug
   ENABLE_FILE_LOGGING=true
   ```

   Generate JWT_SECRET:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Set up the database**

   Run the schema file to create all tables:

   ```bash
   mysql -u your_user -p your_database < sql/schema.sql
   ```

   This will create all necessary tables with the correct structure.

5. **Start the server**

   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

   The server will start on `http://localhost:8080` (or the port specified in your `.env` file).

## Project Structure

```
HRMS-Backend/
├── config/
│   └── logger.js              # No-op logger (logging disabled)
├── middlewares/
│   ├── authenticateJWT.js     # JWT authentication middleware
│   ├── errorHandler.js        # Global error handler
│   ├── notFoundHandler.js     # 404 handler
│   ├── organization.js        # Organization context extraction
│   └── requestLogger.js       # Request payload logger
├── routes/
│   ├── admin/                 # Admin routes
│   ├── attendance/            # Attendance management routes
│   ├── auth/                  # Authentication routes
│   ├── calendar/              # Calendar management routes (holidays, calendars)
│   ├── departments/          # Department management routes
│   ├── employees/             # Employee management routes
│   ├── managers/              # Manager dashboard routes
│   ├── onboarding/            # Employee onboarding routes
│   ├── organization/          # Organization routes
│   ├── organizations/         # Organization management
│   ├── status/                # Health check routes
│   └── users/                  # User management routes
├── sql/
│   └── schema.sql             # Complete database schema
├── util/
│   ├── ApiError.js            # Custom error class
│   ├── authUtil.js            # Authentication utilities
│   ├── employeeUtil.js        # Employee utilities
│   └── securityUtil.js        # Security utilities
├── db.js                      # Database connection pool
├── server.js                  # Main server file
├── .env                       # Environment variables (not in git)
├── .gitignore                 # Git ignore rules
└── package.json               # Dependencies and scripts
```

## API Documentation

### Authentication

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout
- `POST /auth/updatePassword` - Update user password

### Employees

- `GET /employees` - Get all employees
- `GET /employees/:id` - Get employee by ID
- `POST /employees` - Create new employee
- `PATCH /employees/:id` - Update employee
- `DELETE /employees/:id` - Delete employee

### Manager Dashboard

- `GET /managers/:id` - Get manager details
- `GET /managers/:id/employees` - Get manager's direct reports
- `GET /managers/:id/dashboard` - Get team dashboard overview
- `GET /managers/:managerEmpId/employees/attendance` - Get team attendance
- `GET /managers/:id/leaves/pending` - Get pending leave requests
- `GET /managers/:id/analytics` - Get team analytics

See `MANAGER_TEAM_DASHBOARD_APIS.md` for detailed manager API documentation.

### Attendance

- `POST /attendance/clockin` - Clock in
- `POST /attendance/clockout` - Clock out
- `GET /attendance` - Get attendance records
- `GET /attendance/:id` - Get attendance record by ID
- `PATCH /attendance/:id` - Update attendance record
- `GET /attendance-calendar` - Get comprehensive attendance calendar (combines calendar, attendance, and leaves)

### Calendars

- `GET /calendars` - Get calendars by level (ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE)
- `GET /calendars/:id` - Get calendar by ID with holidays, weekly offs, and date overrides
- `POST /calendars` - Create a new calendar
- `PATCH /calendars/:id` - Update calendar
- `DELETE /calendars/:id` - Delete calendar
- `POST /calendars/:id/holidays` - Add holidays to calendar
- `POST /calendars/:id/weekly-offs` - Add weekly offs to calendar
- `GET /calendars/resolve/:empid` - Resolve employee calendar (shows inheritance hierarchy)
- `GET /calendars/monthly/organization` - Get monthly calendar for organization
- `GET /calendars/monthly/location/:location_id` - Get monthly calendar for location
- `GET /calendars/monthly/department/:department_id` - Get monthly calendar for department
- `GET /calendars/monthly/employee/:empid` - Get monthly calendar for employee
- `GET /calendars/working-day/:empid` - Check if a date is a working day
- `GET /calendars/working-days/:empid` - Get working days for a date range

### Holidays

- `GET /holidays` - Get all holidays for a calendar (requires calendar_id)
- `GET /holidays/:id` - Get holiday by ID
- `POST /holidays` - Create a new holiday
- `PATCH /holidays/:id` - Update holiday
- `DELETE /holidays/:id` - Delete holiday

See `docs/CALENDAR_SYSTEM.md` for detailed calendar system documentation.

### Leaves

- `GET /leaves` - Get leave requests
- `POST /leaves` - Create leave request
- `PATCH /leaves/:id` - Update leave request
- `POST /leaves/:id/approve` - Approve leave
- `POST /leaves/:id/reject` - Reject leave
- `GET /employees/:empid/leaves/summary` - Get leave summary for an employee

### Health Check

- `GET /status` - Basic health check
- `GET /status/detailed` - Detailed health check with database info

## Environment Variables

See `ENV_SETUP.md` for detailed environment variable documentation.

### Required Variables

- `JWT_SECRET` - Secret key for JWT token signing (minimum 32 characters)

### Optional Variables

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 3306)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment mode (development, production)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `ENABLE_FILE_LOGGING` - Enable file logging (true/false)

## Logging

Logging is currently disabled in the application. A no-op logger is used that silently ignores all logging calls. This removes logging dependencies and reduces overhead.

To re-enable logging in the future, you can:
1. Install a logging library of your choice
2. Replace the no-op logger in `config/logger.js` with your chosen logging implementation
3. Uncomment logging middleware in `server.js` if needed

## Database Design

The system uses a single-tenant architecture with a clean, normalized database schema.

### Key Features

- `employee_code` (VARCHAR(10)) as primary key in `employee_master` table
- All module tables follow `<module>_master` naming convention
- Foreign keys reference `employee_code` where applicable
- Optimized indexes for query performance

## Testing

Postman collection is available in `postman/` directory:

- Import `ems-backend.postman_collection.json` into Postman
- Import `ems-backend.postman_environment.json` for environment variables
- Authentication tokens are automatically managed via pre-request scripts

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` for automatic server restart on file changes.

### Code Style

- Use ES6+ JavaScript features
- Follow Express.js best practices
- Use async/await for asynchronous operations
- Always include error handling
- Use structured logging instead of console.log

## Security

- JWT tokens for authentication
- Password hashing with bcrypt (10 salt rounds)
- Sensitive fields are redacted in logs
- SQL injection prevention via parameterized queries
- CORS configuration for frontend access

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Copyright (c) 2024 Niyava. All rights reserved.

This software and associated documentation files (the "Software") are proprietary and confidential. Unauthorized copying, modification, distribution, or use of this Software, via any medium, is strictly prohibited without the express written permission of Niyava.

### Proprietary License

- This software is proprietary and not open source
- Redistribution is not permitted
- Modification is not permitted without authorization
- Commercial use is restricted to authorized parties only
- All rights are reserved by Niyava

For licensing inquiries, please contact: ravendra@niyava.com

## Author

Ravendra Kumar Singh

## Support

For support, inquiries, or questions, please contact:

**Ravendra Kumar Singh**  
Email: ravendra@niyava.com  
Website: https://niyava.com

You can also open an issue in the repository for bug reports or feature requests.

### Documentation

For technical documentation, please refer to:

- `docs/CALENDAR_SYSTEM.md` - Calendar system documentation (hierarchical calendars, holidays, weekly offs)
