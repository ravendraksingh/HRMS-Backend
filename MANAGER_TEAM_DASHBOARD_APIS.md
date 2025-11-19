# Manager Team Dashboard - Backend APIs Documentation

## Overview

This document describes all the backend APIs implemented for the Manager Team Dashboard feature. These APIs allow managers to view and manage their direct reports' activities including attendance, leave requests, and team analytics.

## Base URL

All endpoints are prefixed with `/managers` and require:
- JWT authentication via `authenticateJWT` middleware
- Organization context via `extractOrganizationId` middleware (organization_id header)

## API Endpoints

### 1. Get Manager Details

**GET** `/managers/:id`

Get detailed information about a manager.

**Parameters:**
- `id` (path) - Manager ID (can be numeric ID or employee_code)

**Response:**
```json
{
  "id": 1,
  "employee_code": "MGR001",
  "name": "John Manager",
  "email": "john.manager@example.com",
  "manager_id": null,
  "hr_manager_id": 5,
  "department": 2,
  "location_id": 1,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z",
  "department_name": "Engineering",
  "department_code": "ENG",
  "location_name": "Head Office",
  "manager_name": null,
  "manager_code": null,
  "hr_manager_name": "Jane HR",
  "hr_manager_code": "HR001"
}
```

---

### 2. Get Manager's Direct Reports

**GET** `/managers/:id/employees`

Get all employees who report directly to a manager.

**Parameters:**
- `id` (path) - Manager ID (can be numeric ID or employee_code)

**Response:**
```json
{
  "manager_id": 1,
  "manager_name": "John Manager",
  "employees": [
    {
      "id": 10,
      "employee_code": "EMP001",
      "name": "Alice Employee",
      "email": "alice@example.com",
      "manager_id": 1,
      "hr_manager_id": 5,
      "department": 2,
      "location_id": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "department_name": "Engineering",
      "department_code": "ENG",
      "location_name": "Head Office",
      "hr_manager_name": "Jane HR",
      "hr_manager_code": "HR001"
    }
  ],
  "count": 1
}
```

---

### 3. Get Team Dashboard Overview

**GET** `/managers/:id/dashboard`

Get comprehensive team dashboard summary with statistics.

**Parameters:**
- `id` (path) - Manager ID (can be numeric ID or employee_code)
- `date` (query, optional) - Date to check attendance (YYYY-MM-DD), defaults to today

**Response:**
```json
{
  "manager_id": 1,
  "manager_name": "John Manager",
  "date": "2024-01-15",
  "summary": {
    "total_team_members": 10,
    "present_today": 8,
    "absent_today": 1,
    "on_leave_today": 1,
    "late_today": 2,
    "pending_leave_requests": 3,
    "upcoming_birthdays": [
      {
        "employee_id": 10,
        "employee_code": "EMP001",
        "name": "Alice Employee",
        "dob": "1990-01-20"
      }
    ],
    "upcoming_anniversaries": [
      {
        "employee_id": 11,
        "employee_code": "EMP002",
        "name": "Bob Employee",
        "start_date": "2023-01-20T00:00:00.000Z"
      }
    ]
  },
  "attendance_rate_30_days": 95.5,
  "attendance_stats_30_days": {
    "present": 200,
    "absent": 5,
    "on_leave": 10,
    "total_records": 215
  }
}
```

---

### 4. Get Team Attendance

**GET** `/managers/:id/attendance`

Get attendance records for all team members with optional filtering.

**Parameters:**
- `id` (path) - Manager ID (can be numeric ID or employee_code)
- `from` (query, optional) - Start date (YYYY-MM-DD)
- `to` (query, optional) - End date (YYYY-MM-DD)
- `status` (query, optional) - Filter by status: `present`, `absent`, `half_day`, `on_leave`, `week_off`, `holiday`
- `employee_id` (query, optional) - Filter by specific employee

**Response:**
```json
{
  "manager_id": 1,
  "manager_name": "John Manager",
  "attendance": [
    {
      "id": 100,
      "organization_id": 1,
      "employee_id": 10,
      "work_date": "2024-01-15",
      "shift_id": 1,
      "clock_in": "2024-01-15T09:00:00.000Z",
      "clock_out": "2024-01-15T18:00:00.000Z",
      "break_minutes": 60,
      "status": "present",
      "source": "web",
      "notes": null,
      "approved_by": null,
      "approved_at": null,
      "worked_minutes": 480,
      "created_at": "2024-01-15T09:00:00.000Z",
      "updated_at": "2024-01-15T18:00:00.000Z",
      "employee_code": "EMP001",
      "employee_name": "Alice Employee",
      "employee_email": "alice@example.com",
      "department_name": "Engineering"
    }
  ],
  "count": 1,
  "filters": {
    "from": "2024-01-01",
    "to": "2024-01-31",
    "status": null,
    "employee_id": null
  }
}
```

---

### 5. Get Pending Leave Requests

**GET** `/managers/:id/leaves/pending`

Get all pending leave requests from team members.

**Parameters:**
- `id` (path) - Manager ID (can be numeric ID or employee_code)
- `from` (query, optional) - Filter leaves starting from this date (YYYY-MM-DD)
- `to` (query, optional) - Filter leaves ending before this date (YYYY-MM-DD)
- `leave_type` (query, optional) - Filter by type: `casual`, `sick`, `earned`, `unpaid`, `other`
- `employee_id` (query, optional) - Filter by specific employee

**Response:**
```json
{
  "manager_id": 1,
  "manager_name": "John Manager",
  "leaves": [
    {
      "id": 50,
      "organization_id": 1,
      "employee_id": 10,
      "start_date": "2024-01-20",
      "end_date": "2024-01-22",
      "leave_type": "casual",
      "status": "pending",
      "reason": "Family event",
      "approved_by": null,
      "approved_at": null,
      "created_at": "2024-01-10T00:00:00.000Z",
      "updated_at": "2024-01-10T00:00:00.000Z",
      "employee_code": "EMP001",
      "employee_name": "Alice Employee",
      "employee_email": "alice@example.com",
      "department_name": "Engineering",
      "days_count": 3
    }
  ],
  "count": 1,
  "filters": {
    "from": null,
    "to": null,
    "leave_type": null,
    "employee_id": null
  }
}
```

---

### 6. Get Team Analytics

**GET** `/managers/:id/analytics`

Get comprehensive analytics for the team including attendance trends and leave utilization.

**Parameters:**
- `id` (path) - Manager ID (can be numeric ID or employee_code)
- `period` (query, optional) - Number of days to analyze (default: 30)

**Response:**
```json
{
  "manager_id": 1,
  "manager_name": "John Manager",
  "period_days": 30,
  "date_from": "2023-12-16",
  "analytics": {
    "attendance_trends": [
      {
        "work_date": "2024-01-15",
        "total_records": 10,
        "present_count": 9,
        "absent_count": 0,
        "on_leave_count": 1,
        "avg_work_minutes": 480
      }
    ],
    "leave_utilization": [
      {
        "employee_id": 10,
        "employee_code": "EMP001",
        "employee_name": "Alice Employee",
        "total_leaves": 5,
        "approved_days": 10,
        "pending_days": 3
      }
    ],
    "attendance_by_status": {
      "present": 200,
      "absent": 5,
      "on_leave": 10,
      "half_day": 2
    },
    "average_work_hours": 8.0,
    "total_team_members": 10
  }
}
```

---

## Enhanced Existing Endpoints

### 7. Get Leaves (Enhanced)

**GET** `/leaves`

Enhanced to support `manager_id` query parameter.

**Parameters:**
- `employee_id` (query) - Employee ID (required if manager_id not provided)
- `manager_id` (query) - Manager ID (required if employee_id not provided)
- `from` (query, optional) - Start date filter
- `to` (query, optional) - End date filter
- `status` (query, optional) - Filter by status

**Note:** Either `employee_id` OR `manager_id` must be provided, but not both.

**Example:**
```
GET /leaves?manager_id=1&status=pending
```

---

### 8. Get Attendance (Enhanced)

**GET** `/attendance`

Enhanced to support `manager_id` query parameter.

**Parameters:**
- `employee_id` (query, optional) - Employee ID
- `manager_id` (query, optional) - Manager ID
- `work_date` or `date` (query, optional) - Specific date
- `status` (query, optional) - Filter by status
- `approved_by` (query, optional) - Filter by approver

**Note:** `employee_id` and `manager_id` cannot be used together.

**Example:**
```
GET /attendance?manager_id=1&work_date=2024-01-15
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "status": 400
}
```

Common error codes:
- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found (manager/employee not found)
- `500` - Internal Server Error

---

## Authentication & Authorization

All endpoints require:
1. **JWT Token** in the Authorization header: `Bearer <token>`
2. **Organization ID** in the `organization_id` header

The system automatically:
- Validates the manager exists in the organization
- Ensures all returned data belongs to the same organization
- Verifies employees actually report to the specified manager

---

## Usage Examples

### Check if user is a manager
```javascript
// Check if current user has direct reports
GET /managers/{currentUserId}/employees
// If returns employees array with length > 0, user is a manager
```

### Get dashboard on page load
```javascript
GET /managers/{managerId}/dashboard
```

### Get pending leave requests
```javascript
GET /managers/{managerId}/leaves/pending
```

### Approve/reject leave
```javascript
// Use existing leave approval endpoints
POST /leaves/{leaveId}/approve
POST /leaves/{leaveId}/reject
```

### Get team attendance for date range
```javascript
GET /managers/{managerId}/attendance?from=2024-01-01&to=2024-01-31
```

### Get team analytics
```javascript
GET /managers/{managerId}/analytics?period=60
```

---

## Notes

1. **Manager Identification**: Any employee with `manager_id` set to their ID in other employees' records is considered a manager. No separate manager table is needed.

2. **Performance Data**: The current implementation does not include performance tracking as there's no performance table in the database. This can be added later when performance tracking is implemented.

3. **Late Arrival Detection**: The dashboard endpoint checks for late arrivals by comparing clock-in time to 9:30 AM. This can be customized based on shift policies.

4. **Birthdays & Anniversaries**: 
   - Birthdays are based on `employees_personal.dob`
   - Work anniversaries are based on `employees.created_at` (can be enhanced to use employment start date if available)

5. **Multi-tenant Support**: All endpoints properly filter by `organization_id` to ensure data isolation between organizations.

