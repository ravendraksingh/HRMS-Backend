# Calendar System Documentation

## Overview

The calendar system implements a **Workday-style hierarchical calendar** that allows calendars to be defined at multiple levels with inheritance:

1. **Organization** (base/default calendar - single org system, no orgid required)
2. **Location** (overrides organization)
3. **Department** (overrides location)
4. **Employee** (overrides department - most specific)

Each level can override the parent level's holidays and weekly offs.

## Database Schema

### Tables

1. **attendance_calendars** - Calendar definitions at each level
2. **attendance_calendar_holidays** - Holidays in each calendar
3. **attendance_calendar_weekly_offs** - Weekly off days in each calendar
4. **attendance_calendar_date_overrides** - Specific date overrides (make-up days, etc.)

## API Endpoints

### Calendar Management

#### Create Calendar
```
POST /calendars
Body: {
  calendar_name: "Company Calendar 2025",
  calendar_type: "ORGANIZATION" | "LOCATION" | "DEPARTMENT" | "EMPLOYEE",
  year: 2025,
  location_id?: 1,            // Required for LOCATION
  department_id?: "DEPT001",  // Required for DEPARTMENT
  empid?: "EMP001",           // Required for EMPLOYEE
  description?: "Optional description",
  created_by?: "EMP001"
}
Note: ORGANIZATION calendar type does not require orgid (single org system)
```

#### Get Calendars
```
GET /calendars?calendar_type=ORGANIZATION&year=2025
GET /calendars?calendar_type=LOCATION&year=2025&location_id=1
```

#### Get Calendar Details
```
GET /calendars/:id
```

#### Add Holidays to Calendar
```
POST /calendars/:id/holidays
Body: {
  holidays: [
    {
      holiday_date: "2025-01-26",
      holiday_name: "Republic Day",
      is_optional: "N",
      is_override: "N",  // Y if overriding parent calendar
      description?: "National holiday"
    }
  ]
}
```

#### Add Weekly Offs to Calendar
```
POST /calendars/:id/weekly-offs
Body: {
  weekly_offs: [
    {
      day_of_week: 7,  // 1=Monday, 7=Sunday
      is_override: "N"  // Y if overriding parent calendar
    }
  ]
}
```

#### Update Calendar
```
PATCH /calendars/:id
Body: {
  calendar_name?: "New Name",
  description?: "New description",
  is_active?: "Y" | "N"
}
```

#### Delete Calendar
```
DELETE /calendars/:id
```

### Calendar Resolution & Queries

#### Resolve Employee Calendar (View Inheritance)
```
GET /calendars/resolve/:empid?year=2025
```
Returns the resolved calendar showing which calendars were used and how they were merged.

#### Get Monthly Calendar View for Employee
```
GET /calendars/monthly/employee/:empid?year=2025&month=11
```
Returns a monthly calendar with working/non-working day status for each date.

#### Check Working Day
```
GET /calendars/working-day/:empid?date=2025-11-12
```
Returns whether a specific date is a working day and why.

#### Get Working Days for Range
```
GET /calendars/working-days/:empid?start_date=2025-11-01&end_date=2025-11-30
```
Returns all dates in the range with their working day status.

## Usage Examples

### 1. Setting Up Organization Calendar (Base Calendar)

```javascript
// Create organization calendar (no orgid required - single org system)
POST /calendars
{
  "calendar_name": "Company Calendar 2025",
  "calendar_type": "ORGANIZATION",
  "year": 2025
}

// Add holidays
POST /calendars/{calendar_id}/holidays
{
  "holidays": [
    { "holiday_date": "2025-01-26", "holiday_name": "Republic Day", "is_optional": "N" },
    { "holiday_date": "2025-08-15", "holiday_name": "Independence Day", "is_optional": "N" }
  ]
}

// Add weekly offs (Sundays)
POST /calendars/{calendar_id}/weekly-offs
{
  "weekly_offs": [
    { "day_of_week": 7, "is_override": "N" }
  ]
}
```

### 2. Setting Up Location Calendar

```javascript
// Create location calendar
POST /calendars
{
  "calendar_name": "Mumbai Office Calendar 2025",
  "calendar_type": "LOCATION",
  "year": 2025,
  "location_id": 1
}

### 3. Overriding at Department Level

```javascript
// Create department calendar (overrides location)
POST /calendars
{
  "calendar_name": "Engineering Department Calendar 2025",
  "calendar_type": "DEPARTMENT",
  "year": 2025,
  "department_id": "DEPT001"
}

// Add department-specific holiday
POST /calendars/{department_calendar_id}/holidays
{
  "holidays": [
    { 
      "holiday_date": "2025-02-19", 
      "holiday_name": "Mumbai Day", 
      "is_optional": "N",
      "is_override": "N"
    }
  ]
}
```

### 4. Employee-Specific Override

```javascript
// Create employee calendar (overrides department/location)
POST /calendars
{
  "calendar_name": "John's Calendar 2025",
  "calendar_type": "EMPLOYEE",
  "year": 2025,
  "empid": "EMP001"
}

// Override weekly off (employee works different days)
POST /calendars/{employee_calendar_id}/weekly-offs
{
  "weekly_offs": [
    { "day_of_week": 1, "is_override": "Y" },  // Monday off instead of Sunday
    { "day_of_week": 2, "is_override": "Y" }   // Tuesday off
  ]
}
```

### 5. Querying Calendar

```javascript
// Get monthly view
GET /calendars/monthly/EMP001?year=2025&month=11

// Response:
{
  "empid": "EMP001",
  "year": 2025,
  "month": 11,
  "calendar": [
    {
      "date": "2025-11-01",
      "is_working_day": true,
      "reason": "Regular working day",
      "type": "WORKING_DAY"
    },
    {
      "date": "2025-11-02",
      "is_working_day": false,
      "reason": "Weekly off (Sunday)",
      "type": "WEEKLY_OFF"
    },
    {
      "date": "2025-11-03",
      "is_working_day": false,
      "reason": "Diwali",
      "type": "HOLIDAY"
    }
  ],
  "summary": {
    "total_days": 30,
    "working_days": 22,
    "holidays": 2,
    "optional_holidays": 0,
    "weekly_offs": 6,
    "date_overrides": 0
  },
  "source_calendars": [
    {
      "level": "organization",
      "calendar_id": 1,
      "calendar_name": "Company Calendar 2025"
    },
    {
      "level": "location",
      "calendar_id": 2,
      "calendar_name": "Mumbai Office Calendar 2025"
    },
    {
      "level": "department",
      "calendar_id": 3,
      "calendar_name": "Engineering Department Calendar 2025"
    }
  ]
}
```

## Calendar Resolution Logic

When resolving a calendar for an employee:

1. **Start with Organization calendar** (base)
2. **Apply Location calendar** (overrides organization)
3. **Apply Department calendar** (overrides location)
4. **Apply Employee calendar** (overrides department - final)

### Override Behavior

- **Holidays**: If a holiday is marked with `is_override: "Y"`, it removes any holiday from parent calendars for that date
- **Weekly Offs**: If any weekly off in a calendar has `is_override: "Y"`, all parent weekly offs are cleared and only the current calendar's weekly offs are used
- **Date Overrides**: Always take highest priority - override everything else

## Integration with Attendance

The calendar system is integrated with attendance APIs:

- **Clock-in API** checks if the date is a working day (logs warning if not)
- Future: Can be configured to prevent clock-in on non-working days
- Future: Auto-mark non-working days in attendance records

## Migration from Old System

The old `holidays` and `attendance_weekly_off` tables still exist for backward compatibility. To migrate:

1. Create location calendars for current year
2. Import holidays from `holidays` table
3. Import weekly offs from `attendance_weekly_off` table
4. Gradually create department/employee calendars as needed

## Best Practices

1. **Always create Organization calendar first** - This serves as the base (no orgid required for single org system)
2. **Use overrides sparingly** - Only when truly needed
3. **Document calendar changes** - Use description field
4. **Plan ahead** - Create calendars for the full year
5. **Test resolution** - Use `/resolve/:empid` endpoint to verify inheritance

## Future Enhancements

- [ ] Calendar templates (copy from previous year)
- [ ] Bulk import/export (CSV, Excel)
- [ ] Calendar approval workflow
- [ ] Compensatory holidays management
- [ ] Optional holiday requests
- [ ] Calendar analytics and reporting

