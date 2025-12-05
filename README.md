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
- **PII Encryption**: AES-256-GCM encryption for sensitive personal information (PAN, Aadhaar, Passport, etc.)
- **Redis Caching**: High-performance caching layer for frequently accessed data
- **Database Transactions**: ACID-compliant transactions for data consistency
- **Structured Logging**: Pino-based logging with environment-specific formatting
- **RESTful API**: Well-structured REST endpoints following industry best practices

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MySQL 8.0+
- **Cache**: Redis 4.6.0+
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **PII Encryption**: AES-256-GCM
- **Logging**: Pino (structured logging)

## Prerequisites

- Node.js (v14 or higher)
- MySQL 8.0+
- Redis 4.6.0+ (optional but recommended for caching)
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
   TOKEN_SECRET=your_token_secret_here

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=hrms_backend

   # Redis Configuration (Optional but recommended)
   REDIS_URL=redis://localhost:6379

   # Encryption Configuration (REQUIRED for PII encryption)
   ENCRYPTION_KEY=your_64_character_hex_encryption_key_here

   # Server Configuration
   PORT=8080
   NODE_ENV=development

   # Logging (Optional)
   LOG_LEVEL=debug
   ENABLE_FILE_LOGGING=true
   ```

   Generate secrets:

   ```bash
   # Generate JWT_SECRET (32 bytes = 64 hex characters)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate TOKEN_SECRET (32 bytes = 64 hex characters)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate ENCRYPTION_KEY (32 bytes = 64 hex characters for AES-256)
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
│   └── piiFields.js           # PII fields configuration for encryption
├── middlewares/
│   ├── authenticateJWT.js     # JWT authentication middleware
│   ├── cacheHeaders.js        # HTTP cache headers middleware
│   ├── errorHandler.js        # Global error handler
│   ├── notFoundHandler.js     # 404 handler
│   └── rbac.js                # Role-Based Access Control middleware
├── routes/
│   ├── admin/                 # Admin routes
│   ├── attendance/            # Attendance management routes
│   ├── auth/                  # Authentication routes
│   ├── calendar/              # Calendar management routes
│   ├── departments/           # Department management routes
│   ├── employees/             # Employee management routes
│   ├── leaves/                # Leave management routes
│   ├── managers/              # Manager dashboard routes
│   ├── onboarding/            # Employee onboarding routes
│   ├── organization/          # Organization routes
│   ├── status/                # Health check routes
│   └── users/                  # User management routes
├── queries/                   # Reusable SQL queries
│   ├── employees.js
│   ├── departments.js
│   └── locations.js
├── sql/
│   ├── schema.sql             # Complete database schema
│   └── migrations/            # Database migration scripts
├── util/
│   ├── attendanceUtil.js      # Attendance calculation utilities
│   ├── authUtil.js            # Authentication utilities
│   ├── cacheUtil.js           # Redis caching utilities
│   ├── calendarUtil.js        # Calendar utilities
│   ├── encryption.js          # PII encryption utilities
│   ├── logger.js              # Pino logger configuration
│   ├── prefillCache.js        # Cache pre-fill on startup
│   └── redisClient.js        # Redis connection client
├── validations/               # Request validation schemas
│   ├── employeeSchemas.js
│   ├── leaveSchemas.js
│   └── ...
├── errors/
│   └── ApiError.js            # Custom error class
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

- `JWT_SECRET` - Secret key for JWT token signing (minimum 32 characters / 64 hex characters)
- `TOKEN_SECRET` - Secret key for token encryption (64 hex characters)
- `ENCRYPTION_KEY` - PII encryption key (64 hex characters for AES-256)

### Optional Variables

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 3306)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379)
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment mode (development, production)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `ENABLE_FILE_LOGGING` - Enable file logging (true/false)

## Logging

The application uses **Pino** for structured logging:

- **Development**: Human-readable formatted logs with colors
- **Production**: JSON-formatted logs for log aggregation systems
- **Log Levels**: Configurable via `LOG_LEVEL` environment variable (debug, info, warn, error)
- **Performance**: High-performance asynchronous logging

Logging is configured in `util/logger.js` and can be customized per environment.

## Database Design

The system uses a single-tenant architecture with a clean, normalized database schema.

### Key Features

- **Normalized Schema**: Third Normal Form (3NF) compliance
- **Referential Integrity**: Foreign key constraints throughout
- **Transaction Support**: ACID-compliant transactions for critical operations
- **Optimized Indexes**: Strategic indexing for query performance
- **Connection Pooling**: Efficient MySQL connection management

### Transaction Patterns

Critical operations use database transactions to ensure data consistency:

- **Leave Approval**: Updates `leaves` and `leave_balances` tables atomically
- **Attendance Correction**: Creates/updates `attendance_records` and `attendance_correction_requests` atomically
- **Onboarding**: Multiple table operations wrapped in transactions
- **Calendar Operations**: Batch operations use transactions

### Caching Strategy

- **Redis Cache**: Frequently accessed data cached with TTL
- **Cache Pre-fill**: Startup cache warming for common data
- **Cache Invalidation**: Pattern-based invalidation on data updates
- **Graceful Degradation**: Application works without Redis (with reduced performance)

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
- Use structured logging (Pino) instead of console.log
- Use database transactions for multi-table operations
- Implement proper input validation on all routes
- Follow RBAC patterns for authorization

## Security

- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Password Security**: Bcrypt hashing with salt rounds
- **PII Encryption**: AES-256-GCM encryption for sensitive personal data (PAN, Aadhaar, Passport, Driving License)
- **Role-Based Access Control**: Hierarchical RBAC (ADMIN, HRMANAGER, MANAGER, USER)
- **SQL Injection Prevention**: Parameterized queries throughout
- **Input Validation**: Express-validator for request validation
- **CORS Configuration**: Configurable CORS for frontend access
- **Secure Headers**: HTTP security headers and cache control
- **Environment Variables**: All secrets stored in environment variables (never in code)

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

**Copyright (c) 2024 Niyava Technologies Pvt. Ltd. All rights reserved.**

This software and associated documentation files (the "Software") are proprietary and confidential property of Niyava Technologies Pvt. Ltd. This Software is licensed, not sold, under the terms and conditions set forth in the [Commercial License Agreement](LICENSE.md).

### Proprietary License Terms

- This software is proprietary and not open source
- Redistribution is not permitted
- Modification is not permitted without authorization
- Commercial use requires a valid license agreement
- All rights are reserved by Niyava Technologies Pvt. Ltd.

### Licensing Options

Niyava Technologies Pvt. Ltd. offers various licensing models for commercial use:

- **Per-Organization License**: Single organization deployment with unlimited users
- **Per-User License**: Scalable pricing based on number of active users
- **SaaS Subscription**: Cloud-hosted solution with managed infrastructure
- **Enterprise License**: Custom terms with dedicated support and custom development

For detailed licensing information, pricing, or to obtain a commercial license, please see:

- [LICENSE.md](LICENSE.md) - Full commercial license agreement
- [docs/LICENSING_GUIDE.md](docs/LICENSING_GUIDE.md) - Licensing guide and recommendations

**For licensing inquiries, please contact:**  
Email: ravendra@niyava.com  
Website: https://niyava.com

## Author & Company

**Ravendra Kumar Singh**  
**Niyava Technologies Pvt. Ltd.**

## Support

For support, inquiries, or questions, please contact:

**Ravendra Kumar Singh**  
Email: ravendra@niyava.com  
Website: https://niyava.com

You can also open an issue in the repository for bug reports or feature requests.

### Documentation

For technical documentation, please refer to:

- [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) - Complete technical architecture document
- [docs/LICENSING_GUIDE.md](docs/LICENSING_GUIDE.md) - Licensing guide and commercial licensing information
- `docs/CALENDAR_SYSTEM.md` - Calendar system documentation (hierarchical calendars, holidays, weekly offs)
