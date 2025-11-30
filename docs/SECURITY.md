# Security Documentation

## Overview

This document outlines the security measures, practices, and protocols implemented in the HRMS Backend system. Security is a critical aspect of the application, protecting sensitive employee data, authentication credentials, and system integrity.

## Table of Contents

- [Security Architecture](#security-architecture)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Data Protection](#data-protection)
- [Input Validation](#input-validation)
- [SQL Injection Prevention](#sql-injection-prevention)
- [Password Security](#password-security)
- [Token Management](#token-management)
- [CORS Configuration](#cors-configuration)
- [Error Handling Security](#error-handling-security)
- [Environment Security](#environment-security)
- [Database Security](#database-security)
- [API Security](#api-security)
- [Security Best Practices](#security-best-practices)
- [Vulnerability Management](#vulnerability-management)

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────┐
│     1. Network Security (HTTPS)         │
│     • TLS/SSL Encryption                │
│     • Certificate Validation            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     2. Application Security             │
│     • CORS Configuration                 │
│     • Request Validation                 │
│     • Rate Limiting (Future)             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     3. Authentication Layer             │
│     • JWT Token Verification             │
│     • Token Expiry Validation            │
│     • Refresh Token Management           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     4. Authorization Layer               │
│     • Role-Based Access Control          │
│     • Resource-Level Permissions         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     5. Data Protection Layer             │
│     • Password Hashing                   │
│     • SQL Injection Prevention           │
│     • Input Sanitization                 │
└─────────────────────────────────────────┘
```

## Authentication

### JWT-Based Authentication

The system uses JSON Web Tokens (JWT) for stateless authentication.

#### Token Types

1. **Access Token**
   - **Purpose**: Short-lived token for API access
   - **Expiry**: 15 minutes (configurable via `ACCESS_TOKEN_EXPIRY`)
   - **Storage**: 
     - Sent in `Authorization: Bearer <token>` header
     - Optionally stored in HTTP-only cookie
   - **Payload**: Contains `username`, `empid`, `roles`

2. **Refresh Token**
   - **Purpose**: Long-lived token for obtaining new access tokens
   - **Expiry**: 7 days (configurable via `REFRESH_TOKEN_EXPIRY`)
   - **Storage**: 
     - Hashed (SHA-256) and stored in database
     - Sent in request body or cookie
   - **Security**: Single-use recommended (revoked after refresh)

#### Authentication Flow

```
1. User Login (POST /auth/login)
   ├── Validate username/password
   ├── Verify password hash (bcrypt)
   ├── Generate access token (JWT)
   ├── Generate refresh token (random 64-byte hex)
   ├── Hash refresh token (SHA-256)
   ├── Store hashed refresh token in DB
   └── Return tokens to client

2. API Request
   ├── Extract token from Authorization header or cookie
   ├── Verify JWT signature
   ├── Check token expiry
   ├── Validate token payload
   └── Inject user context (req.user)

3. Token Refresh (POST /auth/refresh)
   ├── Validate refresh token
   ├── Check token expiry in DB
   ├── Verify token not revoked
   ├── Generate new access token
   └── Return new access token

4. Logout (POST /auth/logout)
   ├── Revoke refresh token in DB
   ├── Clear cookies (if used)
   └── Return success response
```

#### Token Generation

```javascript
// Access Token
const accessToken = jwt.sign(
  { username, empid, roles },
  JWT_SECRET,
  { expiresIn: '15m' }
);

// Refresh Token (cryptographically secure random)
const refreshToken = crypto.randomBytes(64).toString('hex');
const hashedToken = crypto.createHash('sha256')
  .update(refreshToken)
  .digest('hex');
```

### Password Authentication

#### Password Hashing

- **Algorithm**: bcrypt
- **Salt Rounds**: 10 (configurable)
- **Storage**: Only hashed passwords stored in database

```javascript
// Password Hashing
const saltRounds = 10;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Password Verification
const isValid = await bcrypt.compare(inputPassword, storedHash);
```

#### Password Requirements

- Minimum length: Enforced by application logic
- Complexity: Recommended (not enforced in current version)
- Storage: Never stored in plain text
- Transmission: Should use HTTPS in production

## Authorization

### Role-Based Access Control (RBAC)

The system implements role-based authorization with the following components:

#### Roles

- **USER**: Basic employee access
- **MANAGER**: Manager-level access (team management)
- **HR_MANAGER**: HR department access
- **ADMIN**: Full system access

#### Authorization Middleware

```javascript
// Role-based authorization
function requireAdminRole(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// HR Manager or Admin
function requireHrManagerOrAdmin(req, res, next) {
  // Check user roles from database
  // Allow if HR_MANAGER or ADMIN
}
```

#### Resource-Level Authorization

- Employees can only access their own data
- Managers can access their team's data
- HR Managers can access all employee data
- Admins have full access

### Permission Matrix

| Resource | USER | MANAGER | HR_MANAGER | ADMIN |
|----------|------|---------|------------|-------|
| Own Profile | ✅ | ✅ | ✅ | ✅ |
| Own Attendance | ✅ | ✅ | ✅ | ✅ |
| Own Leaves | ✅ | ✅ | ✅ | ✅ |
| Team Attendance | ❌ | ✅ | ✅ | ✅ |
| Team Leaves | ❌ | ✅ | ✅ | ✅ |
| All Employees | ❌ | ❌ | ✅ | ✅ |
| System Config | ❌ | ❌ | ❌ | ✅ |

## Data Protection

### Sensitive Data Handling

#### Personal Identifiable Information (PII)

- **Employee Data**: Name, email, phone, address
- **Protection**: 
  - Access control (role-based)
  - Encrypted in transit (HTTPS)
  - Stored securely in database

#### Credentials

- **Passwords**: Hashed with bcrypt (never plain text)
- **Tokens**: 
  - Access tokens: Short-lived, signed
  - Refresh tokens: Hashed before storage

#### Financial Data

- **Salary Information**: Restricted to HR and Admin
- **Payroll Data**: Encrypted in transit and at rest

### Data Encryption

#### In Transit

- **HTTPS/TLS**: Required in production
- **Certificate**: Valid SSL/TLS certificate
- **Protocol**: TLS 1.2 or higher

#### At Rest

- **Database**: MySQL encryption at rest (if configured)
- **Passwords**: Hashed (bcrypt)
- **Tokens**: Refresh tokens hashed (SHA-256)

## Input Validation

### Validation Strategy

All user inputs are validated before processing:

1. **Type Validation**: Ensure correct data types
2. **Format Validation**: Email, date, phone formats
3. **Range Validation**: Numeric ranges, string lengths
4. **Business Rule Validation**: Domain-specific rules

### Validation Tools

- **express-validator**: Request validation middleware
- **Custom Validators**: Domain-specific validation logic

### Example Validation

```javascript
// Route-level validation
router.post('/employees', [
  body('empid').notEmpty().isLength({ min: 1, max: 10 }),
  body('email').isEmail().normalizeEmail(),
  body('name').trim().isLength({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res, next) => {
  // Handler logic
});
```

### Input Sanitization

- **SQL Injection**: Prevented via parameterized queries
- **XSS**: Input sanitization (trim, escape)
- **Email**: Normalized (lowercase, trimmed)
- **Strings**: Trimmed and validated

## SQL Injection Prevention

### Parameterized Queries

**✅ Secure (Current Implementation)**
```javascript
const [rows] = await pool.query(
  "SELECT * FROM employees WHERE empid = ?",
  [empid]
);
```

**❌ Vulnerable (Never Use)**
```javascript
// NEVER DO THIS
const query = `SELECT * FROM employees WHERE empid = '${empid}'`;
```

### Best Practices

1. **Always use parameterized queries**
2. **Never concatenate user input into SQL**
3. **Validate input before database queries**
4. **Use prepared statements for complex queries**

## Password Security

### Password Storage

- **Algorithm**: bcrypt with 10 salt rounds
- **Format**: `$2b$10$...` (bcrypt hash format)
- **Never**: Stored in plain text or reversible encryption

### Password Policies

**Current Implementation:**
- Minimum length: Enforced by application
- Complexity: Recommended but not enforced
- Expiry: Not implemented (can be added)
- History: Not implemented (can be added)

**Recommended Enhancements:**
- Minimum 8 characters
- Require uppercase, lowercase, number, special character
- Password expiry (90 days)
- Password history (prevent reuse)

### Password Reset

- **Current**: Manual password update via `/auth/updatePassword`
- **Future**: Automated password reset flow with email verification

## Token Management

### Access Token Security

1. **Short Expiry**: 15 minutes reduces exposure window
2. **Signed**: JWT signature prevents tampering
3. **HTTPS Only**: Should be transmitted over HTTPS
4. **Storage**: 
   - Browser: HTTP-only cookie (recommended)
   - Mobile/API: Secure storage (keychain/keystore)

### Refresh Token Security

1. **Hashed Storage**: SHA-256 hash stored in database
2. **Long Expiry**: 7 days for user convenience
3. **Revocation**: Can be revoked on logout or suspicious activity
4. **Single Use**: Recommended (revoke after refresh)

### Token Rotation

**Current**: Refresh token reused until expiry
**Recommended**: Rotate refresh token on each use

### Token Revocation

- **Logout**: Refresh token revoked in database
- **Suspicious Activity**: Manual revocation
- **Expiry**: Automatic cleanup of expired tokens

## CORS Configuration

### Current Configuration

```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
```

### Security Considerations

1. **Origin Restriction**: Only allow trusted origins
2. **Credentials**: Enabled for cookie-based auth
3. **Methods**: Default (GET, POST, PUT, DELETE, PATCH)
4. **Headers**: Default allowed headers

### Production Recommendations

```javascript
// Production CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN, // Explicit origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));
```

## Error Handling Security

### Error Message Sanitization

**Development Mode:**
- Detailed error messages
- Stack traces
- Database error details

**Production Mode:**
- Generic error messages
- No stack traces
- No sensitive information

### Error Response Format

```javascript
// Secure error response
{
  "error": {
    "message": "Resource not found",
    "status": 404
    // No sensitive data
  }
}
```

### Information Disclosure Prevention

- **Database Errors**: Sanitized in production
- **Stack Traces**: Hidden in production
- **File Paths**: Not exposed
- **System Information**: Limited exposure

## Environment Security

### Environment Variables

**Sensitive Variables:**
- `JWT_SECRET`: Must be strong, random, 32+ characters
- `DB_PASSWORD`: Database password
- `JWT_REFRESH_SECRET`: Refresh token secret

**Security Practices:**
1. **Never commit `.env` files** to version control
2. **Use strong secrets**: Generate with crypto.randomBytes
3. **Rotate secrets**: Periodically rotate JWT secrets
4. **Separate environments**: Different secrets for dev/prod

### Secret Generation

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate 64-byte secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Environment Separation

- **Development**: Local `.env` file
- **Production**: Environment variables or secret management service
- **Staging**: Separate environment with test data

## Database Security

### Connection Security

1. **Encrypted Connection**: Use SSL/TLS for database connections
2. **Strong Credentials**: Complex database passwords
3. **Limited Access**: Database user with minimal required permissions
4. **Connection Pooling**: Limits concurrent connections

### Database User Permissions

**Recommended:**
- Application user: SELECT, INSERT, UPDATE, DELETE on application tables
- No DROP, CREATE, ALTER permissions
- No access to system tables

### Data Protection

1. **Backup Encryption**: Encrypted database backups
2. **Access Logging**: Log database access (if available)
3. **Audit Trail**: Track sensitive data modifications

## API Security

### API Endpoint Security

1. **Authentication Required**: Most endpoints require JWT
2. **Public Endpoints**: Only `/auth/*` and `/status`
3. **Rate Limiting**: Not implemented (recommended for production)
4. **Request Size Limits**: Express body parser limits

### API Versioning

- **Current**: No versioning (can be added)
- **Recommendation**: `/api/v1/` prefix for future versions

### Request Validation

- **Input Validation**: All inputs validated
- **Type Checking**: Data type validation
- **Business Rules**: Domain-specific validation

## Security Best Practices

### Development

1. **Never commit secrets**: Use `.gitignore` for `.env`
2. **Use parameterized queries**: Always
3. **Validate all inputs**: Never trust user input
4. **Handle errors securely**: Don't expose sensitive info
5. **Keep dependencies updated**: Regular security updates

### Production

1. **HTTPS Only**: Enforce HTTPS/TLS
2. **Strong Secrets**: Use strong, random secrets
3. **Environment Variables**: Use secure secret management
4. **Monitoring**: Monitor for suspicious activity
5. **Regular Updates**: Keep dependencies updated
6. **Security Headers**: Add security headers (HSTS, CSP, etc.)

### Recommended Security Headers

```javascript
// Security headers middleware (future enhancement)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

## Vulnerability Management

### Dependency Management

1. **Regular Updates**: Keep npm packages updated
2. **Security Audits**: Run `npm audit` regularly
3. **Vulnerability Scanning**: Automated scanning in CI/CD

### Security Monitoring

1. **Log Analysis**: Monitor error logs for suspicious patterns
2. **Failed Login Attempts**: Track and alert on multiple failures
3. **Unusual Activity**: Monitor for unusual access patterns

### Incident Response

1. **Detection**: Identify security incidents
2. **Containment**: Isolate affected systems
3. **Investigation**: Analyze the incident
4. **Remediation**: Fix vulnerabilities
5. **Documentation**: Document lessons learned

### Security Checklist

- [ ] HTTPS/TLS enabled in production
- [ ] Strong JWT_SECRET (32+ characters)
- [ ] Database credentials secured
- [ ] `.env` file in `.gitignore`
- [ ] All inputs validated
- [ ] Parameterized queries used
- [ ] Error messages sanitized
- [ ] CORS properly configured
- [ ] Dependencies updated
- [ ] Security headers configured
- [ ] Rate limiting implemented (recommended)
- [ ] Monitoring and alerting set up

## Security Recommendations

### Immediate Actions

1. **Enable HTTPS**: Use TLS/SSL in production
2. **Rotate Secrets**: Generate new JWT secrets
3. **Review Permissions**: Audit database user permissions
4. **Update Dependencies**: Run `npm audit fix`

### Future Enhancements

1. **Rate Limiting**: Prevent brute force attacks
2. **Two-Factor Authentication**: Add 2FA for sensitive operations
3. **Password Policies**: Enforce strong password requirements
4. **Audit Logging**: Comprehensive audit trail
5. **IP Whitelisting**: Restrict admin access by IP
6. **Security Headers**: Add security HTTP headers
7. **Content Security Policy**: Implement CSP headers
8. **Session Management**: Enhanced session security

## Conclusion

The HRMS Backend implements multiple layers of security to protect sensitive data and system integrity. Key security measures include:

- **Strong Authentication**: JWT-based with secure token management
- **Password Security**: bcrypt hashing with salt
- **SQL Injection Prevention**: Parameterized queries
- **Input Validation**: Comprehensive validation and sanitization
- **Error Handling**: Secure error messages
- **CORS Configuration**: Restricted origins

Regular security audits, dependency updates, and monitoring are essential for maintaining security posture.

