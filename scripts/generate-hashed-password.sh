#!/bin/bash

# ============================================================================
# Generate Hashed Password Script
# ============================================================================
# This script generates a bcrypt hashed password using the same logic
# as the updatePassword route (10 salt rounds)
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [password]"
    echo ""
    echo "Options:"
    echo "  password    Password to hash (optional, will prompt if not provided)"
    echo ""
    echo "Examples:"
    echo "  $0 mypassword123"
    echo "  $0                    # Will prompt for password"
    exit 1
}

# Get password from argument or prompt
if [ -z "$1" ]; then
    # Prompt for password (hidden input)
    echo -e "${YELLOW}Enter password to hash:${NC}"
    read -s PASSWORD
    echo ""
    if [ -z "$PASSWORD" ]; then
        echo "Error: Password cannot be empty"
        exit 1
    fi
else
    PASSWORD="$1"
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Generate hashed password using Node.js and bcrypt
# Using the same logic as updatePassword route: bcrypt.hash(password, 10)
HASHED_PASSWORD=$(node -e "
const bcrypt = require('bcrypt');
const password = process.argv[1];
bcrypt.hash(password, 10)
  .then(hash => {
    console.log(hash);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error hashing password:', err.message);
    process.exit(1);
  });
" "$PASSWORD")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Hashed Password:${NC}"
    echo "$HASHED_PASSWORD"
    echo ""
    echo -e "${YELLOW}You can use this hash in your SQL INSERT or UPDATE statement:${NC}"
    echo "UPDATE users SET password = '$HASHED_PASSWORD' WHERE username = 'your_username';"
else
    echo "Error: Failed to generate hashed password"
    exit 1
fi

