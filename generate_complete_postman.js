const fs = require('fs');

// Complete Postman Collection with ALL routes
const collection = {
  info: {
    name: "EMS Backend - Complete",
    _postman_id: "f8e1e9e9-0000-4000-9000-ems-backend",
    description: "Complete Postman collection for EMS Backend APIs (single-tenant).\n\n**Important Notes:**\n- **Primary Keys:** All endpoints use VARCHAR codes as primary keys:\n  - Employees: `empid` (VARCHAR(10))\n  - Departments: `deptid` (VARCHAR(10))\n  - Roles: `roleid` (VARCHAR(10))\n  - Leave Types: `leavetype_id` (VARCHAR(3))\n  - Shifts: `shiftid` (VARCHAR(10))\n- **Boolean Fields:** Use 'Y'/'N' (VARCHAR(1)) instead of 1/0 for is_active, is_confidential, etc.\n- **Authentication:** Login first to get `access_token` and `refresh_token`. Access tokens expire in 15 minutes. Use `/auth/refresh` to get a new access token.\n- **Token Management:** Login automatically saves both tokens. Use Refresh Token endpoint when access token expires. Use Logout to revoke refresh token.\n- **404 Handler:** Invalid routes return a structured 404 error response with method, path, and error message\n- **Status Check:** Use `/status` or `/status/detailed` to check database connectivity (public endpoint)",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{token}}", type: "string" }]
  },
  event: [{
    listen: "prerequest",
    script: {
      exec: [
        "const path = pm.request.url.getPath();",
        "const publicPaths = ['/auth/login', '/auth/register', '/auth/updatePassword', '/status'];",
        "const isPublicPath = publicPaths.some(publicPath => path.includes(publicPath));",
        "",
        "if (isPublicPath) {",
        "    pm.request.headers.remove('Authorization');",
        "} else {",
        "    const token = pm.collectionVariables.get('token') || pm.environment.get('token');",
        "    if (token && token.trim() !== '') {",
        "        const existingAuth = pm.request.headers.get('Authorization');",
        "        if (!existingAuth || !existingAuth.includes('Bearer')) {",
        "            pm.request.headers.remove('Authorization');",
        "            pm.request.headers.add({",
        "                key: 'Authorization',",
        "                value: 'Bearer ' + token.trim()",
        "            });",
        "        }",
        "    }",
        "}"
      ],
      type: "text/javascript"
    }
  }],
  item: []
};

function createRequest(name, method, path, body = null, auth = null, description = "") {
  const isPublic = path.includes('/auth/') || path.includes('/status');
  const headers = [{ key: "Content-Type", value: "application/json" }];

  const urlParts = path.split('?');
  const basePath = urlParts[0];
  const queryStr = urlParts[1];

  const request = {
    name: name,
    request: {
      method: method,
      header: headers,
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ["{{baseUrl}}"],
        path: basePath.split('/').filter(p => p && !p.startsWith('{{'))
      }
    }
  };

  // Handle query params
  if (queryStr) {
    request.request.url.query = queryStr.split('&').map(param => {
      const [key, value] = param.split('=');
      return { key, value: value || '' };
    });
  }

  // Handle path variables
  const pathVars = basePath.match(/\{\{(\w+)\}\}/g);
  if (pathVars) {
    pathVars.forEach(v => {
      const varName = v.replace(/[{}]/g, '');
      const idx = request.request.url.path.findIndex(p => p.includes(varName));
      if (idx >= 0) {
        request.request.url.path[idx] = `{{${varName}}}`;
      }
    });
  }

  if (auth === "noauth" || isPublic) {
    request.request.auth = { type: "noauth" };
  }

  if (body) {
    request.request.body = {
      mode: "raw",
      raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2)
    };
  }

  if (description) {
    request.request.description = description;
  }

  return request;
}

function getOrCreateFolder(name) {
  let folder = collection.item.find(f => f.name === name);
  if (!folder) {
    folder = { name: name, item: [] };
    collection.item.push(folder);
  }
  return folder;
}

// 1. Authentication
const authFolder = getOrCreateFolder("Authentication");
authFolder.item = [
  createRequest("Login", "POST", "/auth/login", {
    username: "testuser@example.com",
    password: "password123"
  }, "noauth", "Login and get JWT token. Token is automatically saved.")
];
authFolder.item[0].event = [{
  listen: "test",
  script: {
    exec: [
      "if (pm.response.code === 200) {",
      "    var jsonData = pm.response.json();",
      "    if (jsonData.access_token) {",
      "        pm.collectionVariables.set('token', jsonData.access_token);",
      "        pm.environment.set('token', jsonData.access_token);",
      "        console.log('✅ Token saved');",
      "    }",
      "}"
    ],
    type: "text/javascript"
  }
}];
authFolder.item.push(
  createRequest("Register", "POST", "/auth/register", {
    empid: "EMP-001",
    username: "newuser@example.com",
    password: "password123",
    is_active: "Y"
  }, "noauth"),
  createRequest("Update Password", "POST", "/auth/updatePassword", {
    username: "testuser@example.com",
    password: "newpassword123"
  }, "noauth"),
  createRequest("Refresh Token", "POST", "/auth/refresh", {
    refresh_token: "{{refresh_token}}"
  }, "noauth"),
  createRequest("Logout", "POST", "/auth/logout", {
    refresh_token: "{{refresh_token}}"
  }),
  createRequest("Get User by EmpID", "GET", "/auth/users/{{empid}}", null, "noauth")
);

// 2. Status
const statusFolder = getOrCreateFolder("Status");
statusFolder.item = [
  createRequest("Health Check", "GET", "/status", null, "noauth"),
  createRequest("Detailed Health Check", "GET", "/status/detailed", null, "noauth")
];

// 3. Employees
const empFolder = getOrCreateFolder("Employees");
empFolder.item = [
  createRequest("Get All Employees", "GET", "/employees?department_id=1&manager_id=EMP-001&location_id=1&name=John"),
  createRequest("Get Employee by ID", "GET", "/employees/{{empid}}"),
  createRequest("Create Employee", "POST", "/employees", {
    empid: "EMP-001",
    name: "John Doe",
    email: "john.doe@example.com",
    doj: "2024-01-01",
    manager_id: null,
    hr_manager_id: null,
    department_id: "DEPT-001",
    location_id: 1
  }),
  createRequest("Update Employee", "PATCH", "/employees/{{empid}}", {
    name: "John Updated",
    email: "john.updated@example.com"
  }),
  createRequest("Delete Employee", "DELETE", "/employees/{{empid}}"),
  createRequest("Search Employees", "GET", "/employees/search?search_type=name&search_value=John&fuzzy=true&page=1&limit=10")
];

// 4. Employee Personal
const empPersonalFolder = getOrCreateFolder("Employee Personal");
empPersonalFolder.item = [
  createRequest("Get Employee Personal", "GET", "/employees/{{empid}}/personal"),
  createRequest("Create/Update Employee Personal", "PUT", "/employees/{{empid}}/personal", {
    phone: "+1234567890",
    alternate_phone: "+1234567891",
    date_of_birth: "1990-01-01",
    gender: "male",
    marital_status: "married",
    blood_group: "O+",
    emergency_contact_name: "Jane Doe",
    emergency_contact_phone: "+1234567892",
    emergency_contact_relation: "Spouse",
    permanent_address_line1: "123 Main St",
    permanent_city: "New York",
    permanent_state: "NY",
    permanent_postal_code: "10001",
    permanent_country: "USA",
    current_address_line1: "456 Park Ave",
    current_city: "New York",
    current_state: "NY",
    current_postal_code: "10002",
    current_country: "USA",
    pan_number: "ABCDE1234F",
    aadhaar_number: "123456789012",
    passport_number: "A1234567",
    passport_expiry: "2030-12-31",
    driving_license_number: "DL123456",
    driving_license_expiry: "2025-12-31"
  })
];

// 5. Employee Education
const empEduFolder = getOrCreateFolder("Employee Education");
empEduFolder.item = [
  createRequest("Get Employee Education", "GET", "/employees/{{empid}}/education"),
  createRequest("Add Education", "POST", "/employees/{{empid}}/education", {
    qualification_type: "degree",
    degree: "Bachelor of Science",
    specialization: "Computer Science",
    institution_name: "University of Technology",
    university_board: "State University",
    start_date: "2010-09-01",
    end_date: "2014-06-30",
    percentage: 85.5,
    cgpa: 3.8,
    grade: "A"
  }),
  createRequest("Update Education", "PATCH", "/employees/{{empid}}/education/{{educationId}}", {
    degree: "Master of Science",
    grade: "A+"
  }),
  createRequest("Delete Education", "DELETE", "/employees/{{empid}}/education/{{educationId}}")
];

// 6. Employee Employment History
const empHistFolder = getOrCreateFolder("Employee Employment History");
empHistFolder.item = [
  createRequest("Get Employment History", "GET", "/employees/{{empid}}/employment-history"),
  createRequest("Add Employment History", "POST", "/employees/{{empid}}/employment-history", {
    company_name: "Previous Company",
    designation: "Software Engineer",
    start_date: "2015-01-01",
    end_date: "2020-12-31",
    job_description: "Developed web applications",
    reason_for_leaving: "Better opportunity",
    last_salary: 50000,
    supervisor_name: "John Manager",
    supervisor_contact: "john.manager@example.com"
  }),
  createRequest("Update Employment History", "PATCH", "/employees/{{empid}}/employment-history/{{historyId}}", {
    designation: "Senior Software Engineer"
  }),
  createRequest("Delete Employment History", "DELETE", "/employees/{{empid}}/employment-history/{{historyId}}")
];

// 7. Employee Family
const empFamilyFolder = getOrCreateFolder("Employee Family");
empFamilyFolder.item = [
  createRequest("Get Employee Family", "GET", "/employees/{{empid}}/family"),
  createRequest("Add Family Member", "POST", "/employees/{{empid}}/family", {
    relationship: "Spouse",
    name: "Jane Doe",
    date_of_birth: "1992-05-15",
    gender: "female",
    is_dependent: "Y",
    occupation: "Teacher",
    phone: "+1234567891",
    email: "jane.doe@example.com",
    aadhaar_number: "987654321098",
    is_emergency_contact: "Y"
  }),
  createRequest("Update Family Member", "PATCH", "/employees/{{empid}}/family/{{familyId}}", {
    phone: "+1234567892"
  }),
  createRequest("Delete Family Member", "DELETE", "/employees/{{empid}}/family/{{familyId}}")
];

// 8. Employee Job Information
const empJobInfoFolder = getOrCreateFolder("Employee Job Information");
empJobInfoFolder.item = [
  createRequest("Get Job Information", "GET", "/employees/{{empid}}/job-information"),
  createRequest("Create/Update Job Information", "POST", "/employees/{{empid}}/job-information", {
    job_title: "Software Engineer",
    employment_type: "full_time",
    employment_status: "active",
    date_of_joining: "2024-01-01",
    probation_start_date: "2024-01-01",
    probation_end_date: "2024-04-01",
    probation_status: "completed",
    confirmation_date: "2024-04-01",
    shiftid: "SHIFT-001",
    cost_center: "CC-001",
    employee_category: "regular",
    grade: "G5",
    level: "L3"
  }),
  createRequest("Get Job History", "GET", "/employees/{{empid}}/job-history"),
  createRequest("Add Job History", "POST", "/employees/{{empid}}/job-history", {
    change_type: "promotion",
    previous_job_title: "Junior Developer",
    new_job_title: "Software Engineer",
    previous_department_id: "DEPT-001",
    new_department_id: "DEPT-001",
    effective_date: "2024-01-01",
    reason: "Performance based promotion"
  })
];

// 9. Employee Payroll
const empPayrollFolder = getOrCreateFolder("Employee Payroll");
empPayrollFolder.item = [
  createRequest("Get Payroll Information", "GET", "/employees/{{employee_id}}/payroll-information"),
  createRequest("Create/Update Payroll Information", "POST", "/employees/{{employee_id}}/payroll-information", {
    bank_name: "ABC Bank",
    account_number: "1234567890",
    account_holder_name: "John Doe",
    ifsc_code: "ABCD0123456",
    branch_name: "Main Branch",
    account_type: "salary",
    pan_number: "ABCDE1234F",
    aadhaar_number: "123456789012",
    payment_method: "bank_transfer",
    payroll_frequency: "monthly",
    pf_number: "PF123456",
    esi_number: "ESI123456",
    uan_number: "UAN123456"
  }),
  createRequest("Get Salary Structure", "GET", "/employees/{{employee_id}}/salary-structure?current_only=true"),
  createRequest("Create Salary Structure", "POST", "/employees/{{employee_id}}/salary-structure", {
    effective_from: "2024-01-01",
    basic_salary: 50000,
    house_rent_allowance: 10000,
    transport_allowance: 2000,
    medical_allowance: 1500,
    special_allowance: 5000,
    currency: "INR"
  }),
  createRequest("Get Benefits", "GET", "/employees/{{employee_id}}/benefits?is_active=true"),
  createRequest("Enroll in Benefit", "POST", "/employees/{{employee_id}}/benefits", {
    benefit_type: "health_insurance",
    benefit_name: "Health Insurance Plan A",
    provider_name: "Insurance Co",
    enrollment_date: "2024-01-01",
    coverage_start_date: "2024-01-01",
    premium_amount: 5000,
    employee_contribution: 2000,
    employer_contribution: 3000
  }),
  createRequest("Get Payslips", "GET", "/employees/{{employee_id}}/payslips?from_date=2024-01-01&to_date=2024-12-31"),
  createRequest("Get Tax Forms", "GET", "/employees/{{employee_id}}/tax-forms?tax_year=2024"),
  createRequest("Add Tax Form", "POST", "/employees/{{employee_id}}/tax-forms", {
    form_type: "W-4",
    form_name: "Employee Withholding Certificate",
    tax_year: 2024,
    filing_status: "single",
    exemptions: 1
  })
];

// 10. Employee Compliance
const empComplianceFolder = getOrCreateFolder("Employee Compliance");
empComplianceFolder.item = [
  createRequest("Get Contracts", "GET", "/employees/{{employee_id}}/contracts?is_active=true"),
  createRequest("Create Contract", "POST", "/employees/{{employee_id}}/contracts", {
    contract_type: "full_time",
    contract_number: "CT-001",
    start_date: "2024-01-01",
    end_date: "2025-12-31",
    notice_period_days: 30,
    salary_mentioned: 60000,
    signed_date: "2024-01-01"
  }),
  createRequest("Get Work Permits", "GET", "/employees/{{employee_id}}/work-permits?is_active=true"),
  createRequest("Add Work Permit", "POST", "/employees/{{employee_id}}/work-permits", {
    permit_type: "work_visa",
    permit_number: "WP123456",
    issuing_country: "USA",
    issue_date: "2024-01-01",
    expiry_date: "2025-12-31",
    renewal_reminder_days: 90
  }),
  createRequest("Get Background Checks", "GET", "/employees/{{employee_id}}/background-checks"),
  createRequest("Add Background Check", "POST", "/employees/{{employee_id}}/background-checks", {
    check_type: "criminal",
    vendor_name: "Check Co",
    initiated_date: "2024-01-01",
    completed_date: "2024-01-15",
    result: "clear"
  }),
  createRequest("Get Training Certifications", "GET", "/employees/{{employee_id}}/training-certifications?status=completed"),
  createRequest("Add Training Certification", "POST", "/employees/{{employee_id}}/training-certifications", {
    training_type: "certification",
    training_name: "AWS Certified",
    provider_name: "AWS",
    certification_number: "AWS-123456",
    completion_date: "2024-01-01",
    expiry_date: "2026-01-01",
    status: "completed",
    is_mandatory: true,
    is_compliance_required: true
  }),
  createRequest("Get Health Safety Records", "GET", "/employees/{{employee_id}}/health-safety"),
  createRequest("Add Health Safety Record", "POST", "/employees/{{employee_id}}/health-safety", {
    record_type: "medical_exam",
    record_name: "Annual Medical Exam",
    conducted_date: "2024-01-01",
    expiry_date: "2025-01-01",
    is_compliant: true
  }),
  createRequest("Get Disciplinary Actions", "GET", "/employees/{{employee_id}}/disciplinary-actions?status=open"),
  createRequest("Add Disciplinary Action", "POST", "/employees/{{employee_id}}/disciplinary-actions", {
    action_type: "warning",
    incident_date: "2024-01-01",
    reported_date: "2024-01-02",
    description: "Late arrival",
    severity: "low",
    status: "open"
  }),
  createRequest("Update Disciplinary Action", "PATCH", "/employees/disciplinary-actions/{{id}}", {
    status: "resolved",
    resolution: "Warning issued",
    resolution_date: "2024-01-05"
  })
];

// 11. Employee Leaves
const empLeavesFolder = getOrCreateFolder("Employee Leaves");
empLeavesFolder.item = [
  createRequest("Get Leave Summary", "GET", "/employees/{{empid}}/leaves/summary?year=2024")
];

// 12. Departments
const deptFolder = getOrCreateFolder("Departments");
deptFolder.item = [
  createRequest("Get All Departments", "GET", "/departments"),
  createRequest("Get Department by ID", "GET", "/departments/{{deptid}}"),
  createRequest("Create Department", "POST", "/departments", {
    deptid: "DEPT-001",
    name: "Engineering",
    short_name: "ENG",
    department_head_empid: null
  }),
  createRequest("Update Department", "PATCH", "/departments/{{deptid}}", {
    name: "Updated Department Name",
    department_head_empid: "EMP-001"
  }),
  createRequest("Delete Department", "DELETE", "/departments/{{deptid}}")
];

// 13. Department HR Managers
const deptHrFolder = getOrCreateFolder("Department HR Managers");
deptHrFolder.item = [
  createRequest("Get HR Managers for Department", "GET", "/departments/{{deptid}}/hr-managers?is_active=Y"),
  createRequest("Add HR Manager to Department", "POST", "/departments/{{deptid}}/hr-managers", {
    hr_manager_empid: "HR-001",
    effective_from: "2024-01-01",
    effective_to: "2024-12-31",
    is_active: "Y",
    remarks: "Primary HR Manager"
  }),
  createRequest("Update HR Manager Assignment", "PATCH", "/departments/{{deptid}}/hr-managers/{{id}}", {
    is_active: "N",
    effective_to: "2024-06-30"
  }),
  createRequest("Remove HR Manager from Department", "DELETE", "/departments/{{deptid}}/hr-managers/{{id}}")
];

// 14. Managers
const managersFolder = getOrCreateFolder("Managers");
managersFolder.item = [
  createRequest("Get Manager by ID", "GET", "/managers/{{id}}"),
  createRequest("Get Manager's Employees", "GET", "/managers/{{id}}/employees"),
  createRequest("Get Manager Dashboard", "GET", "/managers/{{id}}/dashboard?date=2024-12-20"),
  createRequest("Get Team Attendance", "GET", "/managers/{{id}}/attendance?from=2024-01-01&to=2024-12-31&status=PRESENT"),
  createRequest("Get Pending Attendance Corrections", "GET", "/managers/{{id}}/attendance/corrections?from_date=2024-01-01&to_date=2024-12-31"),
  createRequest("Get Pending Leave Requests", "GET", "/managers/{{id}}/leaves/pending?from=2024-01-01&to=2024-12-31"),
  createRequest("Get Team Analytics", "GET", "/managers/{{id}}/analytics?period=30")
];

// 15. Attendance
const attendanceFolder = getOrCreateFolder("Attendance");
attendanceFolder.item = [
  createRequest("Clock In", "POST", "/attendance/clockin", {
    empid: "EMP-001",
    attendance_date: "2024-12-20",
    check_in_time: "2024-12-20 09:00:00",
    shiftid: "SHIFT-001"
  }),
  createRequest("Clock Out", "POST", "/attendance/clockout", {
    empid: "EMP-001",
    attendance_date: "2024-12-20",
    check_out_time: "2024-12-20 17:00:00"
  }),
  createRequest("Get Attendance Records", "GET", "/attendance?attendance_date=2024-12-20&empid=EMP-001&status=PRESENT"),
  createRequest("Get Attendance by ID", "GET", "/attendance/{{id}}"),
  createRequest("Update Attendance Record", "PATCH", "/attendance/{{id}}", {
    status: "PRESENT",
    check_in_time: "2024-12-20 09:00:00",
    check_out_time: "2024-12-20 17:00:00",
    remarks: "Updated manually"
  }),
  createRequest("Request Regularization", "POST", "/attendance/{{id}}/regularize", {
    empid: "EMP-001",
    correction_date: "2024-12-20",
    requested_check_in: "2024-12-20 09:00:00",
    requested_check_out: "2024-12-20 17:00:00",
    reason: "Forgot to clock in"
  }),
  createRequest("Get Team Summary", "GET", "/attendance/team/summary?manager_id=EMP-002&attendance_date=2024-12-20")
];

// 16. Attendance Shifts
const shiftsFolder = getOrCreateFolder("Attendance - Shifts");
shiftsFolder.item = [
  createRequest("Get All Shifts", "GET", "/attendance/shifts"),
  createRequest("Get Shift by ID", "GET", "/attendance/shifts/{{shiftid}}"),
  createRequest("Create Shift", "POST", "/attendance/shifts", {
    shiftid: "SHIFT-001",
    name: "Morning Shift",
    start_time: "09:00:00",
    end_time: "17:00:00",
    break_duration_minutes: 60,
    grace_duration_minutes: 15,
    total_hours: 8,
    is_active: "Y"
  }),
  createRequest("Update Shift", "PATCH", "/attendance/shifts/{{shiftid}}", {
    name: "Updated Shift Name",
    start_time: "08:00:00"
  }),
  createRequest("Delete Shift", "DELETE", "/attendance/shifts/{{shiftid}}")
];

// 17. Attendance Shift Assignments
const shiftAssignFolder = getOrCreateFolder("Attendance - Shift Assignments");
shiftAssignFolder.item = [
  createRequest("Get Employee Shift Assignments", "GET", "/employees/{{empid}}/shift-assignments"),
  createRequest("Create Shift Assignment", "POST", "/employees/{{empid}}/shift-assignments", {
    shiftid: "SHIFT-001",
    effective_from: "2024-01-01",
    effective_to: "2024-12-31",
    is_active: "Y"
  })
];

// 18. Attendance Policies
const policiesFolder = getOrCreateFolder("Attendance - Policies");
policiesFolder.item = [
  createRequest("Get All Policies", "GET", "/attendance/policies"),
  createRequest("Create Policy", "POST", "/attendance/policies", {
    name: "Standard Policy",
    grace_in_minutes: 15,
    late_threshold_minutes: 30,
    half_day_threshold_minutes: 240,
    overtime_minimum_minutes: 30,
    rounding_policy: "none"
  }),
  createRequest("Update Policy", "PATCH", "/attendance/policies/{{id}}", {
    grace_in_minutes: 20
  })
];

// 19. Holidays
const holidaysFolder = getOrCreateFolder("Holidays");
holidaysFolder.item = [
  createRequest("Get All Holidays", "GET", "/holidays?year=2024"),
  createRequest("Get Holiday by ID", "GET", "/holidays/{{id}}"),
  createRequest("Create Holiday", "POST", "/holidays", {
    name: "Christmas",
    holiday_date: "2024-12-25",
    is_optional: "N",
    description: "Christmas Day",
    created_by: "EMP-001"
  }),
  createRequest("Update Holiday", "PATCH", "/holidays/{{id}}", {
    name: "Updated Holiday Name"
  }),
  createRequest("Delete Holiday", "DELETE", "/holidays/{{id}}")
];

// 20. Calendars
const calendarsFolder = getOrCreateFolder("Calendars");
calendarsFolder.item = [
  createRequest("Resolve Employee Calendar", "GET", "/calendars/resolve/{{empid}}?year=2024"),
  createRequest("Get Monthly Calendar for Employee", "GET", "/calendars/monthly/employee/{{empid}}?year=2024&month=12"),
  createRequest("Get Monthly Calendar for Organization", "GET", "/calendars/monthly/organization?year=2024&month=12"),
  createRequest("Get Monthly Calendar for Location", "GET", "/calendars/monthly/location/{{location_id}}?year=2024&month=12"),
  createRequest("Get Monthly Calendar for Department", "GET", "/calendars/monthly/department/{{department_id}}?year=2024&month=12"),
  createRequest("Check Working Day", "GET", "/calendars/working-day/{{empid}}?date=2024-12-20"),
  createRequest("Get Working Days", "GET", "/calendars/working-days/{{empid}}?start_date=2024-01-01&end_date=2024-12-31"),
  createRequest("Get Calendars", "GET", "/calendars?calendar_type=ORGANIZATION&year=2024"),
  createRequest("Get Calendar by ID", "GET", "/calendars/{{calendarId}}"),
  createRequest("Create Organization Calendar", "POST", "/calendars", {
    calendar_name: "2024 Organization Calendar",
    calendar_type: "ORGANIZATION",
    year: 2024,
    description: "Main organization calendar"
  }),
  createRequest("Create Location Calendar", "POST", "/calendars", {
    calendar_name: "2024 Location Calendar",
    calendar_type: "LOCATION",
    year: 2024,
    location_id: 1,
    description: "Location calendar"
  }),
  createRequest("Add Holidays to Calendar", "POST", "/calendars/{{calendarId}}/holidays", {
    holidays: [
      {
        holiday_date: "2024-12-25",
        holiday_name: "Christmas",
        is_optional: "N",
        is_override: "N"
      }
    ]
  }),
  createRequest("Add Weekly Offs to Calendar", "POST", "/calendars/{{calendarId}}/weekly-offs", {
    weekly_offs: [
      { day_of_week: 7, is_override: "N" }
    ]
  }),
  createRequest("Update Calendar", "PATCH", "/calendars/{{calendarId}}", {
    calendar_name: "Updated Calendar Name",
    is_active: "Y"
  }),
  createRequest("Delete Calendar", "DELETE", "/calendars/{{calendarId}}")
];

// 21. Attendance Corrections
const correctionsFolder = getOrCreateFolder("Attendance - Corrections");
correctionsFolder.item = [
  createRequest("Create Correction Request", "POST", "/attendance/corrections", {
    empid: "EMP-001",
    attendance_record_id: null,
    correction_date: "2024-12-20",
    requested_check_in: "2024-12-20 09:00:00",
    requested_check_out: "2024-12-20 17:00:00",
    reason: "Forgot to clock in"
  }),
  createRequest("Get Correction Requests", "GET", "/attendance/corrections?empid=EMP-001&status=PENDING&from_date=2024-01-01&to_date=2024-12-31"),
  createRequest("Get Pending Corrections", "GET", "/attendance/corrections/pending?manager_empid=EMP-002"),
  createRequest("Get Correction by ID", "GET", "/attendance/corrections/{{id}}"),
  createRequest("Approve Correction", "POST", "/attendance/corrections/{{id}}/approve", {
    approved_by: "EMP-002",
    remarks: "Approved"
  }),
  createRequest("Reject Correction", "POST", "/attendance/corrections/{{id}}/reject", {
    approved_by: "EMP-002",
    rejection_reason: "Not valid"
  }),
  createRequest("Cancel Correction", "POST", "/attendance/corrections/{{id}}/cancel", {
    empid: "EMP-001"
  })
];

// 22. Overtime
const overtimeFolder = getOrCreateFolder("Overtime");
overtimeFolder.item = [
  createRequest("Get All Overtime", "GET", "/overtime?employee_id=1&from=2024-01-01&to=2024-12-31&status=pending"),
  createRequest("Create Overtime", "POST", "/overtime", {
    employee_id: 1,
    work_date: "2024-12-20",
    minutes: 120,
    reason: "Project deadline"
  }),
  createRequest("Update Overtime", "PATCH", "/overtime/{{id}}", {
    minutes: 180,
    reason: "Updated reason"
  }),
  createRequest("Approve Overtime", "POST", "/overtime/{{id}}/approve", {
    approved_by: 1
  }),
  createRequest("Reject Overtime", "POST", "/overtime/{{id}}/reject", {
    approved_by: 1
  })
];

// 23. Attendance Reports
const reportsFolder = getOrCreateFolder("Attendance - Reports");
reportsFolder.item = [
  createRequest("Get Daily Attendance Report", "GET", "/reports/attendance/daily?attendance_date=2024-12-20"),
  createRequest("Get Monthly Attendance Report", "GET", "/reports/attendance/monthly?month=2024-12&empid=EMP-001")
];

// 24. Weekly Off
const weeklyOffFolder = getOrCreateFolder("Attendance - Weekly Off");
weeklyOffFolder.item = [
  createRequest("Get Weekly Off Configurations", "GET", "/attendance/weekly-off?year=2024&month=12"),
  createRequest("Get Weekly Off by ID", "GET", "/attendance/weekly-off/{{id}}"),
  createRequest("Create Weekly Off", "POST", "/attendance/weekly-off", {
    year: 2024,
    month: 12,
    days_of_week: [0, 6]
  }),
  createRequest("Update Weekly Off", "PATCH", "/attendance/weekly-off/{{id}}", {
    days_of_week: [0, 6]
  }),
  createRequest("Delete Weekly Off", "DELETE", "/attendance/weekly-off/{{id}}")
];

// 25. Leaves
const leavesFolder = getOrCreateFolder("Leaves");
leavesFolder.item = [
  createRequest("Get All Leaves", "GET", "/leaves?empid=EMP-001&from=2024-01-01&to=2024-12-31&status=PENDING"),
  createRequest("Get Leave by ID", "GET", "/leaves/{{id}}"),
  createRequest("Create Leave", "POST", "/leaves", {
    empid: "EMP-001",
    start_date: "2024-12-20",
    end_date: "2024-12-25",
    leavetype_id: "AL",
    reason: "Vacation"
  }),
  createRequest("Update Leave", "PATCH", "/leaves/{{id}}", {
    start_date: "2024-12-21",
    end_date: "2024-12-26"
  }),
  createRequest("Approve Leave", "POST", "/leaves/{{id}}/approve", {
    approved_by: "EMP-002"
  }),
  createRequest("Reject Leave", "POST", "/leaves/{{id}}/reject", {
    approved_by: "EMP-002",
    rejection_reason: "Not enough balance"
  }),
  createRequest("Cancel Leave", "POST", "/leaves/{{id}}/cancel")
];

// 26. Leave Types
const leaveTypesFolder = getOrCreateFolder("Leave Types");
leaveTypesFolder.item = [
  createRequest("Get All Leave Types", "GET", "/leave-types?is_active=Y"),
  createRequest("Get Available Leave Types", "GET", "/leave-types/available"),
  createRequest("Get Leave Type by ID", "GET", "/leave-types/{{id}}"),
  createRequest("Create Leave Type", "POST", "/leave-types", {
    leavetype_id: "AL",
    name: "Annual Leave",
    description: "Annual leave for employees",
    max_leaves_per_year: 20,
    carry_forward: "Y",
    max_carry_forward: 5,
    requires_approval: "Y",
    requires_medical_certificate: "N",
    is_active: "Y"
  }),
  createRequest("Update Leave Type", "PATCH", "/leave-types/{{id}}", {
    max_leaves_per_year: 25
  }),
  createRequest("Delete Leave Type", "DELETE", "/leave-types/{{id}}")
];

// 27. Organizations
const orgFolder = getOrCreateFolder("Organizations");
orgFolder.item = [
  createRequest("Get All Organizations", "GET", "/organizations"),
  createRequest("Get Organization by Code", "GET", "/organizations?orgid=ORG-001"),
  createRequest("Get Organization by ID", "GET", "/organizations/{{orgid}}"),
  createRequest("Create Organization", "POST", "/organizations", {
    orgid: "ORG-001",
    name: "Test Organization",
    short_name: "TEST",
    logo_url: "https://example.com/logo.png",
    is_active: "Y"
  }),
  createRequest("Update Organization", "PATCH", "/organizations/{{orgid}}", {
    name: "Updated Organization Name"
  }),
  createRequest("Delete Organization", "DELETE", "/organizations/{{orgid}}")
];

// 28. Locations
const locationsFolder = getOrCreateFolder("Locations");
locationsFolder.item = [
  createRequest("Get All Locations", "GET", "/locations"),
  createRequest("Get Location by ID", "GET", "/locations/{{id}}"),
  createRequest("Create Location", "POST", "/locations", {
    name: "Main Office",
    address_line1: "123 Main St",
    address_line2: "Suite 100",
    city: "New York",
    state: "NY",
    postal_code: "10001",
    country: "USA",
    phone: "+1234567890"
  }),
  createRequest("Update Location", "PATCH", "/locations/{{id}}", {
    name: "Updated Office Name"
  }),
  createRequest("Delete Location", "DELETE", "/locations/{{id}}"),
  createRequest("Assign Location to Employee", "POST", "/locations/{{id}}/assign-employee/{{empid}}")
];

// 29. Users
const usersFolder = getOrCreateFolder("Users");
usersFolder.item = [
  createRequest("Get All Users", "GET", "/users?is_active=Y&empid=EMP-001"),
  createRequest("Get User Profile", "GET", "/users/{{empid}}/profile"),
  createRequest("Get User by ID", "GET", "/users/{{empid}}"),
  createRequest("Create User", "POST", "/users", {
    empid: "EMP-001",
    username: "newuser",
    password: "password123",
    is_active: "Y",
    roleids: ["USER"]
  }),
  createRequest("Update User", "PATCH", "/users/{{empid}}", {
    is_active: "N",
    roleids: ["USER", "ADMIN"]
  }),
  createRequest("Delete User", "DELETE", "/users/{{empid}}"),
  createRequest("Assign Role to User", "POST", "/users/{{empid}}/roles", {
    roleid: "ADMIN",
    assignedBy: "EMP-002"
  }),
  createRequest("Remove Role from User", "DELETE", "/users/{{empid}}/roles/{{roleid}}")
];

// 30. Roles
const rolesFolder = getOrCreateFolder("Roles");
rolesFolder.item = [
  createRequest("Get All Roles", "GET", "/roles?is_active=Y"),
  createRequest("Get Role by ID", "GET", "/roles/{{roleid}}"),
  createRequest("Create Role", "POST", "/roles", {
    roleid: "MANAGER",
    name: "Manager",
    description: "Manager role",
    permissions: ["read", "write"],
    is_active: "Y"
  }),
  createRequest("Update Role", "PATCH", "/roles/{{roleid}}", {
    name: "Updated Role Name",
    is_active: "N"
  }),
  createRequest("Delete Role", "DELETE", "/roles/{{roleid}}"),
  createRequest("Get Users with Role", "GET", "/roles/{{roleid}}/users")
];

// 31. Onboarding
const onboardingFolder = getOrCreateFolder("Onboarding");
onboardingFolder.item = [
  createRequest("Create Employee (Onboarding)", "POST", "/onboarding", {
    employee_code: "EMP-001",
    name: "John Doe",
    email: "john.doe@example.com",
    department: "DEPT-001",
    manager: "EMP-002",
    hr_manager: "HR-001",
    location_id: 1,
    create_user_account: false
  }),
  createRequest("Update Employee Onboarding", "PATCH", "/onboarding/{{employee_id}}", {
    department: "DEPT-001",
    manager: "EMP-002",
    hr_manager: "HR-001",
    location_id: 1,
    set_as_department_head: false
  })
];

// 32. Admin
const adminFolder = getOrCreateFolder("Admin");
adminFolder.item = [
  createRequest("Get All Employees (Admin)", "GET", "/admin/all-employees"),
  createRequest("Get Employees (Admin)", "GET", "/admin/employees?department=1&page=1&limit=10"),
  createRequest("Get Users (Admin)", "GET", "/admin/users?is_active=Y&page=1&limit=10")
];

// Write collection
fs.writeFileSync(
  'postman/ems-backend.postman_collection.json',
  JSON.stringify(collection, null, 2)
);

console.log('✅ Complete Postman collection generated!');
console.log(`📁 Total folders: ${collection.item.length}`);
console.log(`📊 Total requests: ${collection.item.reduce((sum, f) => sum + f.item.length, 0)}`);
console.log('\n📋 Folders included:');
collection.item.forEach((folder, idx) => {
  console.log(`   ${idx + 1}. ${folder.name} (${folder.item.length} requests)`);
});
