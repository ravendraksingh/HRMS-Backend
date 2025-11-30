# System Architecture

## Overview

The HRMS Backend is a RESTful API service built with Node.js and Express.js, designed to manage human resources, attendance, leaves, calendars, and related organizational data. The system follows a modular, layered architecture with clear separation of concerns.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [System Components](#system-components)
- [Application Layers](#application-layers)
- [Data Flow](#data-flow)
- [Database Architecture](#database-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Scalability Considerations](#scalability-considerations)

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (Web Frontend, Mobile Apps, Postman, API Clients)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTPS/REST API
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    Express.js Server                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Middleware Layer                         │  │
│  │  • CORS • Body Parser • Cookie Parser                │  │
│  │  • JWT Authentication • Error Handling               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Route Layer                              │  │
│  │  • Auth • Employees • Attendance • Calendar          │  │
│  │  • Leaves • Managers • Departments • Organization    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Business Logic Layer                     │  │
│  │  • Utilities • Validators • Models • Services         │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Connection Pool
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    MySQL Database                           │
│  • employees • attendance_records • calendars              │
│  • leaves • holidays • shifts • users • roles             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | v14+ | JavaScript runtime environment |
| Framework | Express.js | 5.x | Web application framework |
| Database | MySQL | 8.0+ | Relational database management system |
| ORM/Driver | mysql2 | 3.x | MySQL client with Promise support |

### Supporting Libraries

| Library | Purpose |
|---------|---------|
| **jsonwebtoken** | JWT token generation and verification |
| **bcrypt** | Password hashing and verification |
| **express-validator** | Request validation and sanitization |
| **cors** | Cross-Origin Resource Sharing |
| **cookie-parser** | Cookie parsing middleware |
| **dotenv** | Environment variable management |
| **morgan** | HTTP request logging (optional) |

## System Components

### 1. Application Server (`server.js`)

The main entry point that:
- Initializes Express application
- Configures middleware
- Registers routes
- Manages database connection
- Handles graceful shutdown
- Implements error handling

**Key Features:**
- Environment-based configuration
- Database connection pooling
- Graceful shutdown on SIGTERM/SIGINT
- Uncaught exception handling
- Health check endpoints

### 2. Route Modules (`routes/`)

Organized by domain/feature:

```
routes/
├── auth/              # Authentication & authorization
├── employees/          # Employee management
├── attendance/        # Attendance tracking
├── calendar/          # Calendar & holidays
├── leaves/            # Leave management
├── managers/          # Manager dashboard
├── departments/       # Department management
├── organization/      # Organization setup
├── users/             # User & role management
├── admin/             # Admin operations
├── onboarding/        # Employee onboarding
└── status/            # Health checks
```

**Route Organization Principles:**
- Specific routes before generic routes (e.g., `/employees/search` before `/employees/:id`)
- Public routes registered before authentication middleware
- Protected routes require JWT authentication
- Error handlers registered last

### 3. Middleware Layer (`middlewares/`)

| Middleware | Purpose |
|------------|---------|
| `authenticateJWT` | JWT token verification and user context injection |
| `errorHandler` | Global error handling and response formatting |
| `notFoundHandler` | 404 error handling for undefined routes |

### 4. Business Logic Layer (`util/`, `models/`, `validations/`)

#### Utilities (`util/`)
- `authUtil.js` - JWT token generation/verification
- `calendarUtil.js` - Calendar resolution and date calculations
- `attendanceUtil.js` - Attendance status calculations
- `employeeUtil.js` - Employee-related utilities
- `validation.js` - Validation error handling

#### Models (`models/`)
- Domain models with `toJSON()` for DTO conversion
- Base model with common functionality
- Database row to model conversion methods

#### Validations (`validations/`)
- Request validation schemas using express-validator
- Domain-specific validation rules

### 5. Database Layer (`db.js`)

**Connection Pool Configuration:**
- Connection limit: 10 concurrent connections
- Wait for connections: Enabled
- Keep-alive: Enabled
- Queue limit: 0 (unlimited)

**Connection Management:**
- Automatic connection pooling
- Connection reuse
- Graceful connection closing on shutdown

## Application Layers

### 1. Presentation Layer (Routes)

**Responsibilities:**
- HTTP request/response handling
- Route parameter extraction
- Request validation
- Response formatting

**Pattern:**
```javascript
router.get("/:id", async (req, res, next) => {
  try {
    // 1. Validate input
    // 2. Call business logic
    // 3. Format response
    res.json({ data });
  } catch (error) {
    next(error); // Pass to error handler
  }
});
```

### 2. Business Logic Layer (Utilities & Services)

**Responsibilities:**
- Business rule enforcement
- Data transformation
- Complex calculations
- Cross-cutting concerns

**Examples:**
- Calendar resolution hierarchy
- Attendance status calculation
- Leave balance computation
- Financial year calculations

### 3. Data Access Layer (Database Queries)

**Responsibilities:**
- SQL query execution
- Parameter binding (SQL injection prevention)
- Result transformation
- Transaction management

**Pattern:**
```javascript
const [rows] = await pool.query(
  "SELECT * FROM employees WHERE empid = ?",
  [empid]
);
```

### 4. Model Layer

**Responsibilities:**
- Data structure definition
- DTO conversion (excluding internal fields)
- Database row mapping

## Data Flow

### Request Flow

```
1. Client Request
   ↓
2. Express Middleware Stack
   ├── CORS
   ├── Body Parser
   ├── Cookie Parser
   └── JWT Authentication (if protected route)
   ↓
3. Route Handler
   ├── Input Validation
   ├── Business Logic
   └── Database Query
   ↓
4. Response Formatter
   ├── Model to DTO conversion
   └── JSON Response
   ↓
5. Client Response
```

### Authentication Flow

```
1. POST /auth/login
   ├── Validate credentials
   ├── Verify password (bcrypt)
   ├── Generate JWT tokens
   │   ├── Access Token (15 min expiry)
   │   └── Refresh Token (7 days expiry)
   ├── Store refresh token (hashed) in DB
   └── Return tokens to client

2. Protected Route Access
   ├── Extract token from header/cookie
   ├── Verify JWT signature
   ├── Check token expiry
   ├── Inject user context (req.user)
   └── Proceed to route handler

3. Token Refresh
   ├── POST /auth/refresh
   ├── Validate refresh token
   ├── Generate new access token
   └── Return new access token
```

## Database Architecture

### Database Design Principles

1. **Single-Tenant Architecture**
   - One organization per database instance
   - No multi-tenancy complexity

2. **Normalized Schema**
   - Third Normal Form (3NF) compliance
   - Minimal data redundancy
   - Foreign key relationships

3. **Naming Conventions**
   - Table names: plural, snake_case (e.g., `employees`, `attendance_records`)
   - Primary keys: domain-specific (e.g., `empid`, `deptid`)
   - Foreign keys: `{table}_id` or `{table}_{key}`

### Key Database Tables

| Category | Tables |
|----------|--------|
| **Core** | `employees`, `departments`, `office_locations`, `organization` |
| **Authentication** | `users`, `roles`, `user_roles`, `refresh_tokens` |
| **Attendance** | `attendance_records`, `attendance_shifts`, `attendance_shift_assignments`, `attendance_overtime`, `attendance_correction_requests`, `attendance_policies`, `attendance_weekly_off` |
| **Calendar** | `attendance_calendars`, `attendance_calendar_holidays`, `attendance_calendar_weekly_offs`, `attendance_calendar_date_overrides` |
| **Leaves** | `leaves`, `leave_types`, `leave_balances` |
| **Management** | `managers`, `department_hr_managers` |
| **Configuration** | `financial_years` |

### Database Relationships

```
organization (1) ──┐
                   │
location (1) ──────┼─── (N) employees
                   │
department (1) ────┘

employees (1) ──── (N) attendance_records
employees (1) ──── (N) leaves
employees (1) ──── (1) users
users (N) ──────── (N) roles (via user_roles)

attendance_calendars (1) ──── (N) attendance_calendar_holidays
attendance_calendars (1) ──── (N) attendance_calendar_weekly_offs
```

## Deployment Architecture

### Development Environment

```
Developer Machine
├── Node.js Runtime
├── Express Server (Port 8080)
└── MySQL Database (Local/Remote)
```

### Production Environment (Recommended)

```
┌─────────────────────────────────────────┐
│         Load Balancer / Reverse Proxy   │
│         (Nginx / AWS ALB)               │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼────┐            ┌────▼────┐
│ App    │            │ App     │
│ Server │            │ Server  │
│ (PM2)  │            │ (PM2)   │
└───┬────┘            └────┬────┘
    │                      │
    └──────────┬───────────┘
               │
        ┌──────▼──────┐
        │   MySQL     │
        │  Database   │
        │ (Primary)   │
        └─────────────┘
```

### Container Deployment (Docker)

```
┌─────────────────────────────────────┐
│         Docker Compose              │
│  ┌──────────────┐  ┌─────────────┐ │
│  │   Node.js    │  │   MySQL    │ │
│  │   Container  │  │  Container │ │
│  │   (Port 8080)│  │  (Port 3306)│ │
│  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling

**Current Limitations:**
- Stateless API design (✅ supports horizontal scaling)
- Database connection pooling (✅ supports concurrent requests)
- No session storage (✅ stateless authentication)

**Scaling Strategy:**
1. **Application Layer**: Deploy multiple instances behind load balancer
2. **Database Layer**: 
   - Read replicas for read-heavy operations
   - Connection pooling optimization
   - Query optimization and indexing

### Vertical Scaling

**Current Configuration:**
- Connection pool: 10 connections
- Can be increased based on server resources

**Optimization Points:**
- Increase connection pool size
- Add database query caching
- Implement response caching (Redis)
- Optimize slow queries

### Performance Optimization

1. **Database Indexing**
   - Primary keys on all tables
   - Foreign key indexes
   - Query-specific indexes

2. **Connection Pooling**
   - Reuse database connections
   - Limit concurrent connections
   - Queue management

3. **Query Optimization**
   - Parameterized queries (SQL injection prevention)
   - Efficient JOIN operations
   - Pagination for large datasets

4. **Caching Strategy** (Future Enhancement)
   - Redis for session/token caching
   - Response caching for frequently accessed data
   - Calendar data caching

## Error Handling Architecture

### Error Flow

```
Route Handler
    ↓ (throws error)
Error Handler Middleware
    ├── Log error
    ├── Format error response
    └── Return JSON error
```

### Error Types

1. **ApiError** - Custom application errors
   - Validation errors (400)
   - Not found errors (404)
   - Unauthorized errors (401)
   - Forbidden errors (403)
   - Server errors (500)

2. **Database Errors** - MySQL errors
   - Connection errors
   - Query errors
   - Constraint violations

3. **JWT Errors** - Authentication errors
   - Token expired
   - Invalid token
   - Missing token

## Security Architecture

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

**Key Security Components:**
- JWT-based authentication
- Password hashing (bcrypt)
- SQL injection prevention (parameterized queries)
- CORS configuration
- Input validation
- Error message sanitization

## Monitoring & Health Checks

### Health Check Endpoints

- `GET /status` - Basic health check
- `GET /status/detailed` - Detailed health with DB info

### Monitoring Points

1. **Application Health**
   - Server uptime
   - Response times
   - Error rates

2. **Database Health**
   - Connection status
   - Query performance
   - Connection pool usage

3. **System Resources**
   - Memory usage
   - CPU usage
   - Disk space

## Future Architecture Enhancements

### Recommended Improvements

1. **Microservices Architecture** (if needed)
   - Separate services for different domains
   - API Gateway for routing
   - Service mesh for communication

2. **Message Queue Integration**
   - Async task processing
   - Event-driven architecture
   - Background job processing

3. **Caching Layer**
   - Redis for session/token storage
   - Response caching
   - Database query result caching

4. **API Gateway**
   - Rate limiting
   - Request routing
   - Authentication/authorization

5. **Observability**
   - Structured logging
   - Distributed tracing
   - Metrics collection (Prometheus)

## Conclusion

The HRMS Backend follows a clean, layered architecture that promotes:
- **Maintainability**: Clear separation of concerns
- **Scalability**: Stateless design supports horizontal scaling
- **Security**: Multiple layers of security measures
- **Reliability**: Error handling and graceful shutdown
- **Testability**: Modular design enables unit testing

The architecture is designed to evolve with the organization's needs while maintaining code quality and performance.

