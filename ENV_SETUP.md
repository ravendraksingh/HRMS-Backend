# Environment Variables Setup

This document describes the required environment variables for the EMS Backend application.

## Required Environment Variables

### JWT_SECRET (Required)

- **Description**: Secret key used for signing and verifying JWT tokens
- **Type**: String
- **Minimum Length**: 32 characters (recommended: 64+ characters)
- **How to Generate**:

  ```bash
  # Using OpenSSL
  openssl rand -hex 32

  # Or using Node.js
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- **Example**: `6a4ca18f4f3ba7dab7c3c8cabc62a1245b2535aec9db4e6cdb8f41ecdedb637d`

### Database Configuration

These are typically required for database connection:

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 3306)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name

### Server Configuration

- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment mode (development, production, etc.)

## Setup Instructions

1. **Create a `.env` file** in the root directory of the project:

   ```bash
   touch .env
   ```

2. **Add the required variables** to your `.env` file:

   ```env
   # JWT Configuration (REQUIRED)
   JWT_SECRET=your_generated_secret_here_minimum_32_characters

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_database_name

   # Server Configuration
   PORT=8080
   NODE_ENV=development
   ```

3. **Load environment variables** in your application:

   - If using `dotenv` package, add this at the top of your main file (e.g., `index.js`):
     ```javascript
     require("dotenv").config();
     ```

4. **Security Notes**:
   - **Never commit `.env` files to version control**
   - Add `.env` to your `.gitignore` file
   - Use different secrets for development, staging, and production
   - Rotate secrets periodically in production
   - Keep secrets secure and never expose them in logs or error messages

## Verification

After setting up your `.env` file, verify that the application starts without errors. If `JWT_SECRET` is missing, the application will throw an error on startup:

```
Error: JWT_SECRET environment variable is required. Please set it in your .env file.
```

## Example .env File

```env
# JWT Configuration
JWT_SECRET=6a4ca18f4f3ba7dab7c3c8cabc62a1245b2535aec9db4e6cdb8f41ecdedb637d

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ems_backend

# Server Configuration
PORT=8080
NODE_ENV=development
```

## Troubleshooting

### Application fails to start with "JWT_SECRET is required"

- Ensure `.env` file exists in the project root
- Verify `JWT_SECRET` is set in the `.env` file
- Check that `dotenv` is installed and configured: `npm install dotenv`
- Verify `require('dotenv').config()` is called before any code that uses `process.env.JWT_SECRET`

### JWT tokens are invalid

- Ensure `JWT_SECRET` is the same across all instances of your application
- Check that the secret hasn't changed between token generation and verification
- Verify the secret meets minimum length requirements (32+ characters)
