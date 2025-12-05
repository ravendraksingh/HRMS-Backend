# HRMS Backend - Technical Architecture Document

**Version:** 1.0  
**Date:** December 2024  
**Author:** Technical Architecture Review  
**Status:** Production-Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Technology Stack](#technology-stack)
4. [Architecture Patterns](#architecture-patterns)
5. [Security Architecture](#security-architecture)
6. [Data Architecture](#data-architecture)
7. [API Architecture](#api-architecture)
8. [Performance & Scalability](#performance--scalability)
9. [Best Practices Compliance](#best-practices-compliance)
10. [Recommendations & Future Enhancements](#recommendations--future-enhancements)
11. [Appendix](#appendix)

---

## Executive Summary

The HRMS Backend is a robust, enterprise-grade Human Resource Management System built on modern web technologies. The system demonstrates strong adherence to industry best practices in security, scalability, and maintainability. This document provides a comprehensive technical overview suitable for business stakeholders, technical teams, and compliance reviews.

### Key Highlights

- **Enterprise-Ready**: Production-grade architecture with comprehensive error handling and graceful degradation
- **Security-First**: Multi-layered security with encryption, RBAC, and JWT authentication
- **Scalable Design**: Stateless architecture with Redis caching and connection pooling
- **Maintainable**: Clean code structure with separation of concerns and modular design
- **Compliant**: PII encryption, audit trails, and data protection measures

### Architecture Rating

| Category        | Rating     | Notes                                                   |
| --------------- | ---------- | ------------------------------------------------------- |
| Security        | ⭐⭐⭐⭐⭐ | Excellent - Encryption, RBAC, JWT, PII protection       |
| Scalability     | ⭐⭐⭐⭐   | Good - Stateless, caching, connection pooling           |
| Maintainability | ⭐⭐⭐⭐⭐ | Excellent - Clean structure, modular design             |
| Performance     | ⭐⭐⭐⭐   | Good - Caching, compression, optimized queries          |
| Reliability     | ⭐⭐⭐⭐   | Good - Error handling, graceful shutdown, health checks |

---

## System Overview

### Purpose

The HRMS Backend provides a comprehensive RESTful API for managing human resources, including employee management, attendance tracking, leave management, calendar systems, and organizational hierarchy management.

### System Characteristics

- **Type**: Single-tenant, monolithic backend service
- **Architecture Style**: RESTful API with layered architecture
- **Deployment Model**: Stateless application server
- **Database**: MySQL 8.0+ (relational database)
- **Caching**: Redis (in-memory cache)
- **Communication**: HTTP/HTTPS (REST API)

### Core Modules

1. **Authentication & Authorization**

   - JWT-based authentication
   - Role-Based Access Control (RBAC)
   - Token refresh mechanism

2. **Employee Management**

   - Employee CRUD operations
   - Personal information management
   - Job information tracking
   - Education and employment history

3. **Attendance Management**

   - Clock in/out functionality
   - Shift management
   - Overtime tracking
   - Attendance corrections
   - Attendance policies

4. **Leave Management**

   - Leave request workflow
   - Leave type management
   - Leave balance tracking
   - Manager approvals

5. **Calendar System**

   - Hierarchical calendar structure (Organization → Location → Department → Employee)
   - Holiday management
   - Weekly offs configuration
   - Date overrides

6. **Organization Management**
   - Department management
   - Location management
   - Financial year configuration
   - Manager hierarchies

---

## Technology Stack

### Core Technologies

| Component      | Technology | Version | Purpose                        |
| -------------- | ---------- | ------- | ------------------------------ |
| Runtime        | Node.js    | v14+    | JavaScript runtime environment |
| Framework      | Express.js | 5.1.0   | Web application framework      |
| Database       | MySQL      | 8.0+    | Primary data store             |
| Cache          | Redis      | 4.6.0+  | In-memory caching layer        |
| Authentication | JWT        | 9.0.2   | Token-based authentication     |

### Key Dependencies

#### Security & Authentication

- `jsonwebtoken` (9.0.2): JWT token generation and verification
- `bcryptjs` (3.0.3): Password hashing
- `crypto-js` (4.2.0): Additional cryptographic functions
- `crypto` (built-in): Node.js cryptographic module for PII encryption

#### Data Validation

- `express-validator` (7.3.1): Request validation middleware
- `class-transformer` (0.5.1): Object transformation utilities

#### Utilities

- `date-fns` (4.1.0): Date manipulation and formatting
- `compression` (1.8.1): HTTP response compression
- `cookie-parser` (1.4.7): Cookie parsing middleware
- `morgan` (1.10.1): HTTP request logging
- `pino` (10.1.0): Structured logging framework
- `pino-pretty` (13.1.3): Human-readable log formatting

#### Database

- `mysql2` (3.15.3): MySQL client with Promise support

### Development Tools

- `nodemon` (3.1.10): Development server with auto-reload

---

## Architecture Patterns

### 1. Layered Architecture

The application follows a clean layered architecture pattern:

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│    (Routes, Middleware, Validation) │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Business Logic Layer        │
│    (Utilities, Services, Helpers)   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Data Access Layer           │
│    (Database Queries, Cache)         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Infrastructure Layer        │
│    (DB, Redis, External Services)   │
└─────────────────────────────────────┘
```

### 2. Modular Route Organization

Routes are organized by domain/feature:

```
routes/
├── auth/              # Authentication endpoints
├── employees/         # Employee management
├── attendance/        # Attendance tracking
├── leaves/           # Leave management
├── calendar/          # Calendar system
├── organization/      # Organization setup
├── departments/       # Department management
├── managers/          # Manager dashboard
└── users/             # User management
```

**Benefits:**

- Clear separation of concerns
- Easy to locate and maintain code
- Supports team collaboration
- Facilitates feature development

### 3. Middleware Pattern

Express middleware chain for cross-cutting concerns:

1. **CORS** - Cross-origin resource sharing
2. **Body Parser** - Request body parsing
3. **Cookie Parser** - Cookie handling
4. **Compression** - Response compression
5. **Authentication** - JWT verification
6. **Authorization** - RBAC checks
7. **Validation** - Request validation
8. **Error Handling** - Global error handler

### 4. Repository Pattern (Partial)

SQL queries are organized in a `queries/` directory, providing:

- Reusable query templates
- Centralized query management
- Easy query optimization
- Reduced SQL injection risks through parameterization

### 5. Error Handling Pattern

Centralized error handling with custom `ApiError` class:

```javascript
// Consistent error response format
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "status": 400,
  "details": { /* optional validation details */ }
}
```

**Features:**

- Standardized error responses
- Proper HTTP status codes
- Detailed error context for debugging
- User-friendly error messages

### 6. Configuration Management

Environment-based configuration using `dotenv`:

- Sensitive data in environment variables
- Environment-specific settings
- No hardcoded secrets
- Easy deployment configuration

---

## Security Architecture

### Security Layers

The system implements multiple layers of security:

```
┌─────────────────────────────────────┐
│   1. Network Security (HTTPS/TLS)   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   2. Authentication (JWT Tokens)    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   3. Authorization (RBAC)            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   4. Input Validation                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   5. Data Encryption (PII)          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   6. Database Security              │
└─────────────────────────────────────┘
```

### 1. Authentication

**JWT-Based Authentication:**

- Access tokens (short-lived, 15 minutes default)
- Refresh tokens (long-lived, 7 days default)
- Token stored in HTTP-only cookies or Authorization header
- Automatic token refresh mechanism

**Password Security:**

- Bcrypt hashing with salt rounds
- No plaintext password storage
- Password update functionality with validation

**Token Management:**

- Secure token generation
- Token expiration handling
- Token revocation support (via database)

### 2. Authorization (RBAC)

**Role-Based Access Control:**

- Hierarchical role system:
  - `ADMIN`: Full system access
  - `HRMANAGER`: HR operations access
  - `MANAGER`: Team management access
  - `USER`: Self-service access

**Access Control Rules:**

- Users can access their own records
- Managers can access direct reports
- HR Managers can access all employee records
- Admins have unrestricted access

**Implementation:**

- Middleware-based authorization
- Route-level access control
- Dynamic SQL filtering based on roles

### 3. Data Encryption

**PII Encryption:**

- AES-256-GCM encryption algorithm
- PBKDF2 key derivation (100,000 iterations)
- Per-field encryption for sensitive data:
  - PAN numbers
  - Aadhaar numbers
  - Passport numbers
  - Driving license numbers

**Encryption Features:**

- Automatic encryption on write
- Automatic decryption on read
- Migration support for existing data
- Key management via environment variables

**Best Practice Note:** In production, consider using:

- AWS KMS (Key Management Service)
- HashiCorp Vault
- Azure Key Vault
- Google Cloud KMS

### 4. Input Validation

**Multi-Layer Validation:**

- Express-validator middleware
- Schema-based validation
- Type checking and sanitization
- SQL injection prevention via parameterized queries

**Validation Coverage:**

- Request body validation
- URL parameter validation
- Query parameter validation
- Email format validation
- Date format validation
- Enum value validation

### 5. Security Headers

**HTTP Security Headers:**

- CORS configuration
- Cache control headers
- No sensitive data in logs
- Secure cookie settings

### 6. Database Security

**Connection Security:**

- Connection pooling with limits
- Parameterized queries (SQL injection prevention)
- Database user with minimal privileges
- Encrypted connections (recommended in production)

**Data Protection:**

- Foreign key constraints
- Data integrity checks
- Transaction support
- Backup and recovery procedures

### Security Compliance

✅ **GDPR Compliance:**

- PII encryption at rest
- Data access controls
- Audit trail capability

✅ **Data Protection:**

- Sensitive data encryption
- Access logging
- Secure data transmission

✅ **Industry Standards:**

- OWASP Top 10 considerations
- Secure coding practices
- Regular security updates

---

## Data Architecture

### Database Design

**Database Type:** MySQL 8.0+ (Relational Database)

**Architecture:** Single-tenant, normalized schema

### Schema Organization

The database schema is organized into logical modules:

```
sql/
├── schema.sql                    # Main schema loader
├── organization/
│   ├── schema.sql               # Organization tables
│   └── financial_years_schema.sql
├── departments/
│   └── schema.sql               # Department tables
├── employees/
│   └── schema.sql               # Employee tables
├── users/
│   └── schema.sql               # User authentication
├── attendance/
│   ├── schema.sql               # Attendance tracking
│   └── calendar_schema.sql      # Calendar system
├── leaves/
│   └── schema.sql               # Leave management
├── documents/
│   └── schema.sql               # Document management
├── reports/
│   └── schema.sql               # Reporting
├── onboarding/
│   └── schema.sql               # Onboarding
└── roles/
    └── schema.sql               # Role definitions
```

### Key Design Principles

1. **Normalization:**

   - Third Normal Form (3NF) compliance
   - Reduced data redundancy
   - Referential integrity via foreign keys

2. **Naming Conventions:**

   - Consistent table naming
   - Descriptive column names
   - Foreign key naming patterns

3. **Data Types:**

   - Appropriate data types for each field
   - VARCHAR with appropriate lengths
   - TIMESTAMP for date/time fields
   - JSON for flexible data structures

4. **Indexing Strategy:**
   - Primary keys on all tables
   - Foreign key indexes
   - Query optimization indexes
   - Composite indexes for common queries

### Connection Management

**Connection Pooling:**

```javascript
{
  connectionLimit: 10,        // Maximum connections
  waitForConnections: true,    // Queue requests if pool exhausted
  queueLimit: 0,              // Unlimited queue
  enableKeepAlive: true,       // Maintain connections
  keepAliveInitialDelay: 0     // Immediate keep-alive
}
```

**Benefits:**

- Efficient connection reuse
- Reduced connection overhead
- Better resource management
- Improved performance

### Data Migration

**Migration Support:**

- SQL migration scripts
- PII encryption migration utility
- Schema versioning capability
- Rollback procedures

### Caching Strategy

**Redis Caching:**

- Frequently accessed data cached
- TTL-based expiration
- Cache invalidation on updates
- Graceful degradation if Redis unavailable

**Cache Patterns:**

- Cache-aside pattern
- Pre-fill cache on startup
- Pattern-based invalidation
- Hierarchical cache keys

**Cached Data Types:**

- Organization information
- Department lists
- Location lists
- Employee search results
- Calendar data
- Financial year information

---

## API Architecture

### RESTful Design

The API follows REST principles:

- **Resource-based URLs:** `/employees`, `/attendance`, `/leaves`
- **HTTP Methods:** GET, POST, PATCH, DELETE
- **Status Codes:** Proper HTTP status codes
- **Stateless:** No server-side session state

### API Structure

**Base URL:** `http://localhost:8080` (configurable)

**Endpoint Categories:**

1. **Authentication** (`/auth`)

   - `POST /auth/login` - User login
   - `POST /auth/register` - User registration
   - `POST /auth/refresh` - Refresh token
   - `POST /auth/logout` - User logout

2. **Employees** (`/employees`)

   - `GET /employees` - List employees
   - `GET /employees/:empid` - Get employee
   - `POST /employees` - Create employee
   - `PATCH /employees/:empid` - Update employee
   - `DELETE /employees/:empid` - Delete employee

3. **Attendance** (`/attendance`)

   - `POST /attendance/clockin` - Clock in
   - `POST /attendance/clockout` - Clock out
   - `GET /attendance` - Get attendance records
   - `GET /attendance/reports` - Attendance reports

4. **Leaves** (`/leaves`)

   - `GET /leaves` - List leave requests
   - `POST /leaves` - Create leave request
   - `PATCH /leaves/:id` - Update leave
   - `POST /leaves/:id/approve` - Approve leave
   - `POST /leaves/:id/reject` - Reject leave

5. **Calendar** (`/calendars`)
   - `GET /calendars` - List calendars
   - `GET /calendars/:id` - Get calendar details
   - `POST /calendars` - Create calendar
   - `GET /calendars/monthly/:type/:id` - Monthly calendar view

### Request/Response Format

**Request Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Response Format:**

```json
{
  "data": {
    /* response data */
  },
  "message": "Success message (optional)"
}
```

**Error Response:**

```json
{
  "message": "Error message",
  "code": "ERROR_CODE",
  "status": 400,
  "details": {
    /* validation errors */
  }
}
```

### API Versioning

**Current Status:** No versioning implemented

**Recommendation:** Implement API versioning for future changes:

- `/v1/employees`
- `/v2/employees`

### Rate Limiting

**Current Status:** Not implemented

**Recommendation:** Implement rate limiting to prevent abuse:

- Per-user rate limits
- Per-IP rate limits
- Endpoint-specific limits

### API Documentation

**Current:** Postman collection available

**Recommendation:** Consider:

- OpenAPI/Swagger documentation
- Interactive API documentation
- Automated API testing

---

## Performance & Scalability

### Current Performance Features

1. **Connection Pooling**

   - MySQL connection pool (10 connections)
   - Efficient connection reuse
   - Reduced connection overhead

2. **Caching**

   - Redis for frequently accessed data
   - TTL-based cache expiration
   - Cache invalidation strategies

3. **Response Compression**

   - Gzip compression for large responses
   - Configurable compression threshold (1KB)
   - Selective compression by route

4. **Query Optimization**

   - Indexed database columns
   - Parameterized queries
   - Efficient JOIN operations

5. **HTTP Caching**
   - Browser cache headers
   - Configurable cache durations
   - Cache control directives

### Scalability Considerations

**Horizontal Scalability:**
✅ **Stateless Design:** Application is stateless, enabling horizontal scaling
✅ **Load Balancer Ready:** Can be deployed behind load balancers
✅ **Session Management:** JWT tokens enable stateless authentication

**Vertical Scalability:**
✅ **Connection Pooling:** Efficient resource usage
✅ **Caching:** Reduces database load
✅ **Async Operations:** Non-blocking I/O

### Performance Metrics

**Recommended Monitoring:**

- Response time (p50, p95, p99)
- Request throughput (requests/second)
- Database query performance
- Cache hit ratio
- Error rate
- Resource utilization (CPU, memory)

### Optimization Opportunities

1. **Database Indexing:**

   - Review query patterns
   - Add composite indexes
   - Optimize slow queries

2. **Caching Strategy:**

   - Expand cache coverage
   - Implement cache warming
   - Monitor cache hit rates

3. **Query Optimization:**

   - Analyze slow queries
   - Optimize JOIN operations
   - Consider read replicas for reporting

4. **Response Optimization:**
   - Implement pagination
   - Add field selection
   - Optimize JSON serialization

---

## Best Practices Compliance

### Code Quality

✅ **Modular Structure:** Well-organized codebase
✅ **Separation of Concerns:** Clear layer separation
✅ **Error Handling:** Comprehensive error handling
✅ **Validation:** Input validation on all endpoints
✅ **Documentation:** Code comments and README

### Security Best Practices

✅ **Authentication:** JWT-based authentication
✅ **Authorization:** RBAC implementation
✅ **Encryption:** PII data encryption
✅ **Input Validation:** Request validation
✅ **SQL Injection Prevention:** Parameterized queries
✅ **Password Security:** Bcrypt hashing

### API Design Best Practices

✅ **RESTful Design:** REST principles followed
✅ **HTTP Methods:** Proper method usage
✅ **Status Codes:** Appropriate status codes
✅ **Error Handling:** Consistent error format
✅ **Request Validation:** Input validation

### Database Best Practices

✅ **Normalization:** 3NF compliance
✅ **Indexing:** Appropriate indexes
✅ **Foreign Keys:** Referential integrity
✅ **Connection Pooling:** Efficient connection management
✅ **Transactions:** Transaction support

### DevOps Best Practices

✅ **Environment Configuration:** Environment variables
✅ **Graceful Shutdown:** Proper shutdown handling
✅ **Health Checks:** Health check endpoints
✅ **Logging:** Structured logging (Pino)
✅ **Error Tracking:** Error logging and context

### Areas for Improvement

⚠️ **API Versioning:** Not implemented
⚠️ **Rate Limiting:** Not implemented
⚠️ **Comprehensive Testing:** Test suite not visible
⚠️ **CI/CD Pipeline:** Not visible in codebase
⚠️ **Monitoring & Alerting:** Limited observability
⚠️ **Documentation:** API documentation could be enhanced

---

## Recommendations & Future Enhancements

### High Priority

1. **API Versioning**

   - Implement versioning strategy
   - Support multiple API versions
   - Deprecation policy

2. **Rate Limiting**

   - Implement rate limiting middleware
   - Per-user and per-IP limits
   - Protect against abuse

3. **Comprehensive Testing**

   - Unit tests for utilities
   - Integration tests for APIs
   - End-to-end tests for critical flows
   - Test coverage reporting

4. **Enhanced Monitoring**

   - Application performance monitoring (APM)
   - Error tracking (e.g., Sentry)
   - Log aggregation (e.g., ELK stack)
   - Metrics dashboard

5. **API Documentation**
   - OpenAPI/Swagger specification
   - Interactive API documentation
   - Automated documentation generation

### Medium Priority

6. **Database Optimization**

   - Query performance analysis
   - Additional indexes
   - Read replicas for reporting
   - Database connection monitoring

7. **Caching Enhancements**

   - Cache warming strategies
   - Cache hit rate monitoring
   - Distributed caching for multi-instance deployments

8. **Security Enhancements**

   - Key management service integration
   - Security audit logging
   - Penetration testing
   - Security headers (Helmet.js)

9. **CI/CD Pipeline**

   - Automated testing
   - Automated deployment
   - Environment promotion
   - Rollback capabilities

10. **Documentation**
    - Architecture decision records (ADRs)
    - API usage examples
    - Deployment guides
    - Troubleshooting guides

### Low Priority

11. **Microservices Consideration**

    - Evaluate microservices architecture
    - Service decomposition strategy
    - Inter-service communication

12. **GraphQL API**

    - Consider GraphQL for flexible queries
    - Reduce over-fetching
    - Improve frontend performance

13. **Event-Driven Architecture**

    - Event sourcing for audit trails
    - Event-driven notifications
    - Async processing

14. **Multi-Tenancy**
    - Evaluate multi-tenant architecture
    - Tenant isolation strategies
    - Data segregation

---

## Appendix

### A. Technology Versions

| Technology | Version | Notes               |
| ---------- | ------- | ------------------- |
| Node.js    | 14+     | Runtime requirement |
| Express.js | 5.1.0   | Web framework       |
| MySQL      | 8.0+    | Database            |
| Redis      | 4.6.0+  | Cache               |
| JWT        | 9.0.2   | Authentication      |

### B. Key Files Reference

| File                             | Purpose                   |
| -------------------------------- | ------------------------- |
| `server.js`                      | Application entry point   |
| `db.js`                          | Database connection pool  |
| `middlewares/rbac.js`            | Role-based access control |
| `middlewares/authenticateJWT.js` | JWT authentication        |
| `util/encryption.js`             | PII encryption utilities  |
| `util/cacheUtil.js`              | Redis caching utilities   |
| `errors/ApiError.js`             | Error handling class      |
| `sql/schema.sql`                 | Database schema           |

### C. Environment Variables

**Required:**

- `JWT_SECRET` - JWT signing secret
- `TOKEN_SECRET` - Token encryption secret
- `ENCRYPTION_KEY` - PII encryption key

**Optional:**

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `REDIS_URL`
- `PORT`, `NODE_ENV`
- `LOG_LEVEL`

### D. Architecture Diagrams

**System Architecture:**

```
┌─────────────┐
│   Client    │
│ (Web/Mobile)│
└──────┬──────┘
       │ HTTPS
       ↓
┌──────────────────┐
│  Load Balancer   │ (Future)
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Express Server  │
│  (Node.js App)   │
└──────┬───────────┘
       │
       ├──────────→ ┌─────────┐
       │            │  Redis  │
       │            │  Cache  │
       │            └─────────┘
       │
       ↓
┌──────────────────┐
│     MySQL        │
│   Database       │
└──────────────────┘
```

**Request Flow:**

```
Client Request
    ↓
CORS Middleware
    ↓
Body Parser
    ↓
Authentication (JWT)
    ↓
Authorization (RBAC)
    ↓
Validation
    ↓
Route Handler
    ↓
Business Logic
    ↓
Database/Cache
    ↓
Response
    ↓
Error Handler (if error)
```

### E. Security Checklist

- [x] JWT authentication implemented
- [x] RBAC authorization implemented
- [x] PII encryption implemented
- [x] Password hashing (bcrypt)
- [x] Input validation
- [x] SQL injection prevention
- [x] CORS configuration
- [ ] Rate limiting (recommended)
- [ ] Security headers (Helmet.js recommended)
- [ ] Key management service (recommended)

### F. Performance Checklist

- [x] Connection pooling
- [x] Redis caching
- [x] Response compression
- [x] Database indexing
- [x] HTTP caching headers
- [ ] Query optimization review
- [ ] Cache hit rate monitoring
- [ ] Performance testing

---

## Document Revision History

| Version | Date          | Author           | Changes                       |
| ------- | ------------- | ---------------- | ----------------------------- |
| 1.0     | December 2024 | Technical Review | Initial architecture document |

---

## Contact & Support

For technical questions or architecture discussions:

- **Email:** ravendra@niyava.com
- **Repository:** HRMS-Backend

---

**Document Status:** ✅ Complete and Ready for Publication

This document provides a comprehensive overview of the HRMS Backend technical architecture, suitable for business stakeholders, technical teams, compliance reviews, and future development planning.
