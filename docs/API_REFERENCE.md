# API Reference Documentation

## Overview

This document provides comprehensive API reference for the HRMS Backend. All endpoints follow RESTful conventions and return JSON responses.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Status & Health](#status--health)
  - [Employees](#employees)
  - [Attendance](#attendance)
  - [Calendar](#calendar)
  - [Leaves](#leaves)
  - [Managers](#managers)
  - [Departments](#departments)
  - [Organization](#organization)
  - [Users & Roles](#users--roles)
  - [Admin](#admin)
  - [Onboarding](#onboarding)

## Base URL

```
Development: http://localhost:8080
Production: https://api.yourdomain.com
```

## Authentication

### Authentication Method

The API uses JWT (JSON Web Tokens) for authentication. Most endpoints require a valid access token.

### Getting an Access Token

1. **Login** to get access and refresh tokens:
   ```http
   POST /auth/login
   ```

2. **Include token** in requests:
   ```http
   Authorization: Bearer <access_token>
   ```

3. **Refresh token** when access token expires:
   ```http
   POST /auth/refresh
   ```

### Token Details

- **Access Token**: Expires in 15 minutes
- **Refresh Token**: Expires in 7 days
- **Token Type**: Bearer

### Public Endpoints

The following endpoints do not require authentication:
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/updatePassword`
- `GET /status`
- `GET /status/detailed`

## Common Patterns

### Request Headers

```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

### Response Format

**Success Response:**
```json
{
  "data": { ... },
  "message": "Success message"
}
```

**Error Response:**
```json
{
  "error": {
    "message": "Error message",
    "status": 400,
    "code": "ERROR_CODE"
  }
}
```

### Pagination

Some endpoints support pagination:
```http
GET /employees?page=1&limit=10
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### Filtering

Many endpoints support filtering via query parameters:
```http
GET /employees?department_id=1&location_id=2
```

### Date Formats

- **Date**: `YYYY-MM-DD` (e.g., `2024-12-20`)
- **Month**: `YYYY-MM` (e.g., `2024-12`)
- **DateTime**: `YYYY-MM-DD HH:MM:SS` (e.g., `2024-12-20 09:00:00`)
- **Financial Year**: `YYYY-YY` (e.g., `2024-25`)

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Error Response Format

```json
{
  "error": {
    "message": "Error description",
    "status": 400,
    "code": "ERROR_CODE",
    "details": { ... }
  }
}
```

## API Endpoints

## Authentication Endpoints

### Login

Authenticate user and receive access/refresh tokens.

```http
POST /auth/login
```

**Request Body:**
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "username": "user@example.com",
    "empid": "EMP-001",
    "name": "John Doe",
    "roles": ["USER"]
  }
}
```

### Register

Register a new user account.

```http
POST /auth/register
```

**Request Body:**
```json
{
  "empid": "EMP-001",
  "username": "user@example.com",
  "password": "password123",
  "is_active": "Y"
}
```

### Refresh Token

Get a new access token using refresh token.

```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refresh_token": "a1b2c3d4e5f6..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

### Logout

Revoke refresh token and logout user.

```http
POST /auth/logout
```

**Request Body:**
```json
{
  "refresh_token": "a1b2c3d4e5f6..."
}
```

### Update Password

Update user password.

```http
POST /auth/updatePassword
```

**Request Body:**
```json
{
  "username": "user@example.com",
  "password": "newpassword123"
}
```

## Status & Health

### Health Check

Basic health check endpoint.

```http
GET /status
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-12-20T10:00:00.000Z",
  "message": "Service is healthy and database is connected"
}
```

### Detailed Health Check

Detailed health check with system information.

```http
GET /status/detailed
```

**Response:**
```json
{
  "status": "ok",
  "database": {
    "connected": true,
    "version": "8.0.33",
    "database": "hrms"
  },
  "server": {
    "uptime": "3600s",
    "environment": "production",
    "node_version": "v18.17.0"
  },
  "timestamp": "2024-12-20T10:00:00.000Z"
}
```

## Employees

### Get All Employees

Get list of employees with optional filters.

```http
GET /employees
```

**Query Parameters:**
- `department_id` (optional): Filter by department
- `manager_id` (optional): Filter by manager
- `location_id` (optional): Filter by location
- `name` (optional): Filter by name (partial match)

**Response:**
```json
{
  "employees": [
    {
      "empid": "EMP-001",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "doj": "2024-01-01",
      "department_id": "DEPT-001",
      "location_id": 1,
      "manager_name": "Jane Manager",
      "department_name": "Engineering"
    }
  ]
}
```

### Get Employee by ID

Get employee details by ID.

```http
GET /employees/:empid
```

**Response:**
```json
{
  "employee": {
    "empid": "EMP-001",
    "name": "John Doe",
    "email": "john.doe@example.com",
    ...
  }
}
```

### Create Employee

Create a new employee.

```http
POST /employees
```

**Request Body:**
```json
{
  "empid": "EMP-001",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "doj": "2024-01-01",
  "department_id": "DEPT-001",
  "location_id": 1,
  "manager_id": "EMP-002"
}
```

### Update Employee

Update employee information.

```http
PATCH /employees/:empid
```

**Request Body:**
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

### Delete Employee

Delete an employee.

```http
DELETE /employees/:empid
```

### Search Employees

Search employees with various filters.

```http
GET /employees/search
```

**Query Parameters:**
- `search_type` (required): `empid`, `name`, `department`, `location`
- `search_value` (required): Search term
- `fuzzy` (optional): Enable fuzzy search (default: `true`)
- `name_starts_with` (optional): Filter by first letter (A-Z)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 100)

### Employee Calendar

#### Resolve Employee Calendar

Get calendar resolution hierarchy for an employee.

```http
GET /employees/:empid/calendar/resolve
```

**Query Parameters:**
- `financial_year` (optional): Financial year in `YYYY-YY` format

**Response:**
```json
{
  "empid": "EMP-001",
  "financial_year": "2024-25",
  "calendar": {
    "calendar_id": 1,
    "calendar_name": "Organization Calendar",
    "source_calendars": [...]
  }
}
```

#### Get Monthly Calendar

Get monthly calendar view for an employee.

```http
GET /employees/:empid/calendar/monthly
```

**Query Parameters:**
- `month` (required): Month in `YYYY-MM` format

#### Check Working Day

Check if a date is a working day for an employee.

```http
GET /employees/:empid/calendar/working-day
```

**Query Parameters:**
- `date` (required): Date in `YYYY-MM-DD` format

#### Get Working Days

Get working days for a date range.

```http
GET /employees/:empid/calendar/working-days
```

**Query Parameters:**
- `start_date` (required): Start date in `YYYY-MM-DD` format
- `end_date` (required): End date in `YYYY-MM-DD` format

### Employee Attendance

#### Clock In

Record employee clock-in.

```http
POST /employees/:empid/attendance/clockin
```

**Request Body:**
```json
{
  "attendance_date": "2024-12-20",
  "check_in_time": "2024-12-20 09:00:00",
  "shiftid": "SHIFT-001"
}
```

#### Clock Out

Record employee clock-out.

```http
POST /employees/:empid/attendance/clockout
```

**Request Body:**
```json
{
  "attendance_date": "2024-12-20",
  "check_out_time": "2024-12-20 17:00:00"
}
```

#### Get Today's Attendance

Get today's attendance record for an employee.

```http
GET /employees/:empid/attendance/today
```

#### Get Attendance Records

Get attendance records for a date range.

```http
GET /employees/:empid/attendance
```

**Query Parameters:**
- `start_date` (optional): Start date in `YYYY-MM-DD` format
- `end_date` (optional): End date in `YYYY-MM-DD` format

#### Get Monthly Attendance Report

Get monthly attendance report with statistics.

```http
GET /employees/:empid/attendance/monthly
```

**Query Parameters:**
- `month` (required): Month in `YYYY-MM` format

**Response:**
```json
{
  "empid": "EMP-001",
  "month": "2024-12",
  "statistics": {
    "total_days": 31,
    "working_days": 22,
    "present_days": 20,
    "absent_days": 2,
    "leave_days": 2
  },
  "daily_records": [...]
}
```

#### Get Attendance Calendar

Get comprehensive attendance calendar for a date range.

```http
GET /employees/:empid/calendar/attendance
```

**Query Parameters:**
- `start_date` (optional): Start date (defaults to current week Monday)
- `end_date` (optional): End date (defaults to current week Sunday)

#### Get Monthly Attendance Calendar

Get comprehensive attendance calendar for a month.

```http
GET /employees/:empid/calendar/attendance/monthly
```

**Query Parameters:**
- `month` (optional): Month in `YYYY-MM` format (defaults to current month)

### Employee Leaves

#### Get All Leaves

Get all leave requests for an employee.

```http
GET /employees/:empid/leaves
```

**Query Parameters:**
- `start_date` (optional): Filter by start date
- `end_date` (optional): Filter by end date
- `status` (optional): Filter by status (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`)

#### Create Leave Request

Create a new leave request.

```http
POST /employees/:empid/leaves
```

**Request Body:**
```json
{
  "start_date": "2024-12-20",
  "end_date": "2024-12-25",
  "leavetype_id": "AL",
  "reason": "Vacation",
  "medical_certificate_url": null
}
```

#### Get Yearly Leave Summary

Get yearly leave summary for an employee.

```http
GET /employees/:empid/leaves/summary/yearly
```

**Query Parameters:**
- `year` (required): Year in `YYYY` format

### Employee Holidays

Get holidays applicable to an employee.

```http
GET /employees/:empid/holidays
```

**Query Parameters:**
- `financial_year` (optional): Financial year in `YYYY-YY` format

## Attendance

### Get Attendance by ID

Get attendance record by ID.

```http
GET /attendance/:id
```

### Update Attendance Record

Update an attendance record.

```http
PATCH /attendance/:id
```

**Request Body:**
```json
{
  "status": "PRESENT",
  "check_in_time": "2024-12-20 09:00:00",
  "check_out_time": "2024-12-20 17:00:00",
  "remarks": "Updated manually"
}
```

### Shifts

#### Get All Shifts

Get all shifts.

```http
GET /attendance/shifts
```

**Query Parameters:**
- `is_active` (optional): Filter by active status (`Y`/`N`)

#### Get Shift by ID

Get shift details by ID.

```http
GET /attendance/shifts/:shiftid
```

#### Create Shift

Create a new shift.

```http
POST /attendance/shifts
```

**Request Body:**
```json
{
  "shiftid": "SHIFT-001",
  "name": "Morning Shift",
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "break_duration_minutes": 60,
  "grace_duration_minutes": 15,
  "total_hours": 8,
  "is_active": "Y"
}
```

### Shift Assignments

#### Get All Shift Assignments

Get all shift assignments.

```http
GET /attendance/shift-assignments
```

**Query Parameters:**
- `empid` (optional): Filter by employee ID
- `shiftid` (optional): Filter by shift ID
- `is_active` (optional): Filter by active status

#### Create Shift Assignment

Assign a shift to an employee.

```http
POST /attendance/shift-assignments
```

**Request Body:**
```json
{
  "empid": "EMP-001",
  "shiftid": "SHIFT-001",
  "effective_from": "2024-01-01",
  "effective_to": "2024-12-31",
  "is_active": "Y",
  "assigned_by": "EMP-002"
}
```

### Weekly Off

#### Get Weekly Off Configurations

Get weekly off configurations.

```http
GET /attendance/weekly-off
```

**Query Parameters:**
- `month` (optional): Month in `YYYY-MM` format
- `employee_id` (optional): Filter by employee ID
- `department_id` (optional): Filter by department ID

#### Create Weekly Off

Create weekly off configuration.

```http
POST /attendance/weekly-off
```

**Request Body:**
```json
{
  "month": "2024-12",
  "days_of_week": [0, 6]
}
```

### Overtime

#### Get All Overtime Records

Get overtime records (for managers/admin).

```http
GET /attendance/overtime
```

**Query Parameters:**
- `empid` (optional): Filter by employee ID
- `from_date` (optional): Filter from date
- `to_date` (optional): Filter to date
- `status` (optional): Filter by status (`PENDING`, `APPROVED`, `REJECTED`)

#### Approve Overtime

Approve an overtime request.

```http
POST /attendance/overtime/:id/approve
```

**Request Body:**
```json
{
  "approved_by": "EMP-002"
}
```

#### Reject Overtime

Reject an overtime request.

```http
POST /attendance/overtime/:id/reject
```

**Request Body:**
```json
{
  "approved_by": "EMP-002",
  "rejection_reason": "Not approved"
}
```

### Attendance Corrections

#### Get Correction Requests

Get attendance correction requests.

```http
GET /employees/:empid/attendance/corrections
```

**Query Parameters:**
- `status` (optional): Filter by status
- `from_date` (optional): Filter from date
- `to_date` (optional): Filter to date

#### Create Correction Request

Create an attendance correction request.

```http
POST /employees/:empid/attendance/corrections
```

**Request Body:**
```json
{
  "correction_date": "2024-12-20",
  "requested_check_in": "2024-12-20 09:00:00",
  "requested_check_out": "2024-12-20 17:00:00",
  "reason": "Forgot to clock in"
}
```

#### Approve Correction

Approve an attendance correction.

```http
POST /attendance/corrections/:id/approve
```

**Request Body:**
```json
{
  "approved_by": "EMP-002",
  "remarks": "Approved"
}
```

## Calendar

### Get Monthly Calendar for Organization

Get monthly calendar view for organization.

```http
GET /calendars/monthly/organization
```

**Query Parameters:**
- `month` (required): Month in `YYYY-MM` format

### Get Monthly Calendar for Location

Get monthly calendar view for a location.

```http
GET /calendars/monthly/location/:location_id
```

**Query Parameters:**
- `month` (required): Month in `YYYY-MM` format

### Get Monthly Calendar for Department

Get monthly calendar view for a department.

```http
GET /calendars/monthly/department/:department_id
```

**Query Parameters:**
- `month` (required): Month in `YYYY-MM` format

### Get Calendars

Get calendars by level and year.

```http
GET /calendars
```

**Query Parameters:**
- `calendar_type` (optional): `ORGANIZATION`, `LOCATION`, `DEPARTMENT`, `EMPLOYEE`
- `year` (optional): Filter by year

### Create Calendar

Create a new calendar.

```http
POST /calendars
```

**Request Body:**
```json
{
  "calendar_name": "2024 Organization Calendar",
  "calendar_type": "ORGANIZATION",
  "year": 2024,
  "description": "Main organization calendar"
}
```

## Holidays

### Get All Holidays

Get all holidays for a calendar.

```http
GET /holidays
```

**Query Parameters:**
- `calendar_id` (required): Calendar ID
- `year` (optional): Filter by year

### Create Holiday

Create a new holiday.

```http
POST /holidays
```

**Request Body:**
```json
{
  "calendar_id": 1,
  "name": "Christmas",
  "holiday_date": "2024-12-25",
  "is_optional": "N",
  "description": "Christmas Day"
}
```

## Leaves

### Get Leave by ID

Get leave request details.

```http
GET /leaves/:id
```

### Approve Leave

Approve a leave request.

```http
POST /leaves/:id/approve
```

**Request Body:**
```json
{
  "approved_by": "EMP-002"
}
```

### Reject Leave

Reject a leave request.

```http
POST /leaves/:id/reject
```

**Request Body:**
```json
{
  "approved_by": "EMP-002",
  "rejection_reason": "Not enough balance"
}
```

## Managers

### Get Manager Dashboard

Get manager dashboard overview.

```http
GET /managers/:managerEmpId/dashboard
```

**Query Parameters:**
- `date` (optional): Date in `YYYY-MM-DD` format

### Get Team Attendance

Get team attendance.

```http
GET /managers/:managerEmpId/employees/attendance
```

**Query Parameters:**
- `start_date` (optional): Start date
- `end_date` (optional): End date
- `status` (optional): Filter by status

### Get Pending Leave Requests

Get pending leave requests for team.

```http
GET /managers/:id/leaves/pending
```

**Query Parameters:**
- `from` (optional): Filter from date
- `to` (optional): Filter to date

## Departments

### Get All Departments

Get list of all departments.

```http
GET /departments
```

### Get Department by ID

Get department details.

```http
GET /departments/:deptid
```

### Create Department

Create a new department.

```http
POST /departments
```

**Request Body:**
```json
{
  "deptid": "DEPT-001",
  "name": "Engineering",
  "short_name": "ENG",
  "department_head_empid": "EMP-001"
}
```

## Organization

### Get Organization

Get organization details.

```http
GET /organization
```

### Create Organization

Create organization.

```http
POST /organization
```

**Request Body:**
```json
{
  "orgid": "ORG-001",
  "name": "Test Organization",
  "short_name": "TEST",
  "is_active": "Y"
}
```

### Financial Years

#### Get All Financial Years

Get all financial years.

```http
GET /financial-years
```

**Query Parameters:**
- `is_active` (optional): Filter by active status
- `is_current` (optional): Filter by current status

#### Get Current Financial Year

Get the current financial year.

```http
GET /financial-years/current
```

#### Create Financial Year

Create a new financial year.

```http
POST /financial-years
```

**Request Body:**
```json
{
  "financial_year": "2024-25",
  "start_date": "2024-04-01",
  "end_date": "2025-03-31",
  "is_current": "Y",
  "is_active": "Y",
  "description": "Financial Year 2024-25"
}
```

## Users & Roles

### Get All Users

Get list of all users.

```http
GET /users
```

**Query Parameters:**
- `is_active` (optional): Filter by active status

### Create User

Create a new user account.

```http
POST /users
```

**Request Body:**
```json
{
  "empid": "EMP-001",
  "username": "user@example.com",
  "password": "password123",
  "is_active": "Y",
  "roleids": ["USER"]
}
```

### Get All Roles

Get list of all roles.

```http
GET /roles
```

**Query Parameters:**
- `is_active` (optional): Filter by active status

## Admin

### Get All Employees (Admin)

Get all employees with admin access.

```http
GET /admin/all-employees
```

### Get Employees (Admin)

Get employees with pagination.

```http
GET /admin/employees
```

**Query Parameters:**
- `department` (optional): Filter by department
- `page` (optional): Page number
- `limit` (optional): Results per page

## Onboarding

### Create Employee (Onboarding)

Complete onboarding process for a new employee.

```http
POST /onboarding
```

**Request Body:**
```json
{
  "employee_code": "EMP-001",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "department": "DEPT-001",
  "manager": "EMP-002",
  "hr_manager": "HR-001",
  "location_id": 1,
  "create_user_account": false
}
```

## Rate Limiting

Currently, rate limiting is not implemented. It is recommended for production deployment to prevent abuse.

## Versioning

The API does not currently use versioning. Future versions may use `/api/v1/` prefix.

## Support

For API support, please refer to:
- Postman Collection: `postman/ems-backend.postman_collection.json`
- System Architecture: `docs/ARCHITECTURE.md`
- Security Documentation: `docs/SECURITY.md`

