# EMS Backend

A comprehensive Employee Management System (EMS) backend built with Node.js, Express.js, and MySQL. This system supports multi-tenant architecture, allowing multiple organizations to use the same application instance with complete data isolation.

## Features

- **Multi-Tenant Architecture**: Support for multiple organizations with complete data isolation
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Employee Management**: Complete CRUD operations for employees, departments, and locations
- **Attendance Tracking**: Clock in/out, leave management, overtime tracking, and shift management
- **Manager Dashboard**: Comprehensive team management APIs for managers
- **Role-Based Access Control**: Flexible user roles and permissions
- **Structured Logging**: Winston-based logging with daily log rotation
- **RESTful API**: Well-structured REST endpoints following industry best practices

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MySQL 8.0+
- **Authentication**: JWT (JSON Web Tokens)
- **Logging**: Winston with daily log rotation
- **Password Hashing**: bcrypt

## Prerequisites

- Node.js (v14 or higher)
- MySQL 8.0 or higher
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ems-backend
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
   DB_NAME=ems_backend
   
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
   
   **Option 1: Use consolidated schema (Recommended for new setups)**
   
   For MySQL:
   ```bash
   mysql -u your_user -p your_database < sql/01_setup_mysql.sql
   ```
   
   For PostgreSQL:
   ```bash
   psql -U your_user -d your_database -f sql/01_setup_postgresql.sql
   ```
   
   **Option 2: Use individual schema files (if needed)**
   
   Run the SQL schema files in order:
   ```bash
   # Run main schema
   mysql -u your_user -p your_database < sql/schema.sql
   
   # Run organization schema
   mysql -u your_user -p your_database < sql/organizations/schema.sql
   mysql -u your_user -p your_database < sql/organizations/01_organizations.sql
   
   # Run employees schema
   mysql -u your_user -p your_database < sql/employees/schema.sql
   mysql -u your_user -p your_database < sql/employees/00_employees.sql
   # ... continue with other schema files
   
   # Run migrations
   mysql -u your_user -p your_database < sql/migrations/007_rename_department_to_department_id.sql
   ```

   See `sql/SETUP_INSTRUCTIONS.md` for detailed setup instructions for both MySQL and PostgreSQL.

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
ems-backend/
├── config/
│   └── logger.js              # Winston logger configuration
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
│   ├── departments/           # Department management routes
│   ├── employees/             # Employee management routes
│   ├── managers/              # Manager dashboard routes
│   ├── onboarding/            # Employee onboarding routes
│   ├── organization/          # Organization routes
│   ├── organizations/         # Organization management
│   ├── status/                # Health check routes
│   └── users/                 # User management routes
├── sql/
│   ├── migrations/            # Database migrations
│   ├── attendance/            # Attendance schema
│   ├── departments/           # Department schema
│   ├── employees/             # Employee schema
│   ├── organizations/         # Organization schema
│   └── users/                 # User schema
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
- `GET /managers/:id/attendance` - Get team attendance
- `GET /managers/:id/leaves/pending` - Get pending leave requests
- `GET /managers/:id/analytics` - Get team analytics

See `MANAGER_TEAM_DASHBOARD_APIS.md` for detailed manager API documentation.

### Attendance

- `POST /attendance/clockin` - Clock in
- `POST /attendance/clockout` - Clock out
- `GET /attendance` - Get attendance records
- `GET /attendance/:id` - Get attendance record by ID
- `PATCH /attendance/:id` - Update attendance record

### Leaves

- `GET /leaves` - Get leave requests
- `POST /leaves` - Create leave request
- `PATCH /leaves/:id` - Update leave request
- `POST /leaves/:id/approve` - Approve leave
- `POST /leaves/:id/reject` - Reject leave

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

The application uses Winston for structured logging:

- **Console Logging**: Enabled in all environments with colorized output in development
- **File Logging**: Enabled in production or when `ENABLE_FILE_LOGGING=true`
  - Combined logs: `logs/combined-YYYY-MM-DD.log` (14 days retention)
  - Error logs: `logs/error-YYYY-MM-DD.log` (30 days retention)
- **Log Levels**: debug, info, warn, error
- **Log Format**: JSON in files, human-readable in console

Logs include context such as:
- Organization ID (for multi-tenant tracking)
- User ID
- Request method and path
- Error stack traces

## Database Design

The system uses a multi-tenant architecture with shared database and shared schema. See `MULTI_TENANT_DESIGN.md` for detailed design documentation.

### Key Features

- Surrogate primary keys (`id`) for all tables
- Business keys (`employee_code`, `department_code`) for real-world identifiers
- Composite unique constraints for multi-tenant isolation
- Composite indexes for optimized queries
- Organization context enforced at application layer

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
- Organization context isolation
- SQL injection prevention via parameterized queries
- CORS configuration for frontend access

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

ISC

## Author

Ravendra Singh

## Support

For issues and questions, please refer to the documentation files:
- `ENV_SETUP.md` - Environment setup
- `MULTI_TENANT_DESIGN.md` - Database design
- `MANAGER_TEAM_DASHBOARD_APIS.md` - Manager API documentation
- `sql/migrations/README.md` - Database migrations

