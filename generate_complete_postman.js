const fs = require('fs');

// Complete Postman Collection with ALL routes
const collection = {
  info: {
    name: "EMS Backend - Complete",
    _postman_id: "f8e1e9e9-0000-4000-9000-ems-backend",
    description: "Complete Postman collection for EMS Backend APIs (multi-tenant via X-Org-Id).\n\n**Important Notes:**\n- When creating employees, use `employee_code` (VARCHAR) in the request body\n- Employee endpoints accept both numeric IDs and employee codes in URLs (e.g., `/employees/123` or `/employees/E-001`)\n- Other endpoints use `employee_id` which refers to the numeric foreign key (BIGINT) to `employees.id`\n- **Authentication:** Login first to get a token, then all authenticated requests will automatically include the Authorization header",
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
        "const publicPaths = ['/auth/login', '/auth/register', '/auth/updatePassword'];",
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
  const isPublic = path.includes('/auth/') || (path.includes('/organizations') && !path.includes('/organizations/') || path.match(/\/organizations\/\d+/));
  const headers = [{ key: "Content-Type", value: "application/json" }];
  
  if (!isPublic && method !== 'GET' || (isPublic && method === 'GET' && path.includes('/organizations'))) {
    // For GET /organizations, it's public but might need X-Org-Id
  } else if (!isPublic) {
    headers.push({ key: "X-Org-Id", value: "{{orgId}}" });
  }

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
    if (isPublic) {
      request.request.header = request.request.header.filter(h => h.key !== "X-Org-Id");
    }
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
      "    if (jsonData.token) {",
      "        pm.collectionVariables.set('token', jsonData.token);",
      "        if (jsonData.user && jsonData.user.organization_id) {",
      "            pm.collectionVariables.set('orgId', jsonData.user.organization_id);",
      "            pm.environment.set('orgId', jsonData.user.organization_id);",
      "        }",
      "        pm.environment.set('token', jsonData.token);",
      "        console.log('✅ Token saved');",
      "    }",
      "}"
    ],
    type: "text/javascript"
  }
}];
authFolder.item.push(
  createRequest("Register", "POST", "/auth/register", {
    username: "newuser@example.com",
    password: "password123",
    employee_id: "E-001",
    is_active: 1,
    role: "user"
  }, "noauth"),
  createRequest("Update Password", "POST", "/auth/updatePassword", {
    username: "testuser@example.com",
    password: "newpassword123"
  }, "noauth")
);

// 2. Organizations (public)
const orgFolder = getOrCreateFolder("Organizations");
orgFolder.item = [
  createRequest("Get Organization by Code", "GET", "/organizations?code=ORG001", null, "noauth"),
  createRequest("Get Organization by ID", "GET", "/organizations/{{orgId}}", null, "noauth"),
  createRequest("Create Organization", "POST", "/organizations", {
    code: "ORG001",
    name: "Test Organization",
    logo_url: "https://example.com/logo.png",
    is_active: true
  }, "noauth"),
  createRequest("Update Organization", "PATCH", "/organizations/{{orgId}}", {
    name: "Updated Organization Name",
    logo_url: "https://example.com/new-logo.png",
    is_active: true
  }, "noauth")
];

// 3. Employees
const empFolder = getOrCreateFolder("Employees");
empFolder.item = [
  createRequest("Get All Employees", "GET", "/employees"),
  createRequest("Get Employee by ID", "GET", "/employees/{{employeeId}}"),
  createRequest("Create Employee", "POST", "/employees", {
    employee_code: "EMP-001",
    name: "John Doe",
    email: "john.doe@example.com",
    manager_id: null,
    department: 1,
    location_id: 1
  }),
  createRequest("Update Employee", "PATCH", "/employees/{{employeeId}}", {
    name: "John Updated",
    email: "john.updated@example.com",
    hr_manager_id: 2,
    department: 1
  }),
  createRequest("Get Available HR Managers", "GET", "/employees/{{employeeId}}/available-hr-managers")
];

// 4. Employee Personal
const empPersonalFolder = getOrCreateFolder("Employee Personal");
empPersonalFolder.item = [
  createRequest("Get Employee Personal", "GET", "/employees/{{employeeId}}/personal"),
  createRequest("Create/Update Employee Personal", "PUT", "/employees/{{employeeId}}/personal", {
    dob: "1990-01-01",
    gender: "male",
    marital_status: "married",
    phone_primary: "+1234567890",
    address_line1: "123 Main St",
    city: "New York",
    state: "NY",
    postal_code: "10001",
    country: "USA",
    emergency_contact_name: "Jane Doe",
    emergency_contact_relation: "Spouse",
    emergency_contact_phone: "+1234567891"
  })
];

// 5. Employee Education
const empEduFolder = getOrCreateFolder("Employee Education");
empEduFolder.item = [
  createRequest("Get Employee Education", "GET", "/employees/{{employeeId}}/education"),
  createRequest("Add Education", "POST", "/employees/{{employeeId}}/education", {
    degree: "Bachelor of Science",
    institution: "University of Technology",
    field_of_study: "Computer Science",
    start_date: "2010-09-01",
    end_date: "2014-06-30",
    grade: "3.8"
  }),
  createRequest("Update Education", "PATCH", "/employees/{{employeeId}}/education/{{educationId}}", {
    degree: "Master of Science",
    grade: "3.9"
  }),
  createRequest("Delete Education", "DELETE", "/employees/{{employeeId}}/education/{{educationId}}")
];

// 6. Employee Employment History
const empHistFolder = getOrCreateFolder("Employee Employment History");
empHistFolder.item = [
  createRequest("Get Employment History", "GET", "/employees/{{employeeId}}/employment-history"),
  createRequest("Add Employment History", "POST", "/employees/{{employeeId}}/employment-history", {
    company_name: "Previous Company",
    job_title: "Software Engineer",
    start_date: "2015-01-01",
    end_date: "2020-12-31",
    responsibilities: "Developed web applications"
  }),
  createRequest("Update Employment History", "PATCH", "/employees/{{employeeId}}/employment-history/{{historyId}}", {
    job_title: "Senior Software Engineer"
  }),
  createRequest("Delete Employment History", "DELETE", "/employees/{{employeeId}}/employment-history/{{historyId}}")
];

// 7. Employee Family
const empFamilyFolder = getOrCreateFolder("Employee Family");
empFamilyFolder.item = [
  createRequest("Get Employee Family", "GET", "/employees/{{employeeId}}/family"),
  createRequest("Add Family Member", "POST", "/employees/{{employeeId}}/family", {
    name: "Jane Doe",
    relation: "Spouse",
    dob: "1992-05-15",
    phone: "+1234567891",
    dependent: true
  }),
  createRequest("Update Family Member", "PATCH", "/employees/{{employeeId}}/family/{{familyId}}", {
    phone: "+1234567892"
  }),
  createRequest("Delete Family Member", "DELETE", "/employees/{{employeeId}}/family/{{familyId}}")
];

// 8. Departments
const deptFolder = getOrCreateFolder("Departments");
deptFolder.item = [
  createRequest("Get All Departments", "GET", "/departments"),
  createRequest("Get Department by ID", "GET", "/departments/{{departmentId}}"),
  createRequest("Create Department", "POST", "/departments", {
    department_code: "DEPT-001",
    name: "Engineering"
  }),
  createRequest("Update Department", "PATCH", "/departments/{{departmentId}}", {
    name: "Updated Department Name",
    department_code: "DEPT-001-UPDATED",
    department_head: 1
  }),
  createRequest("Delete Department", "DELETE", "/departments/{{departmentId}}")
];

// 9. Department HR Managers
const deptHrFolder = getOrCreateFolder("Department HR Managers");
deptHrFolder.item = [
  createRequest("Get HR Managers for Department", "GET", "/departments/{{departmentId}}/hr-managers"),
  createRequest("Add HR Manager to Department", "POST", "/departments/{{departmentId}}/hr-managers", {
    hr_manager: "HR-001"
  }),
  createRequest("Remove HR Manager from Department", "DELETE", "/departments/{{departmentId}}/hr-managers/{{hrManagerId}}")
];

// 10. Managers
const managersFolder = getOrCreateFolder("Managers");
managersFolder.item = [
  createRequest("Get All Managers", "GET", "/managers"),
  createRequest("Get Manager by ID", "GET", "/managers/{{managerId}}"),
  createRequest("Get Manager's Employees", "GET", "/managers/{{managerId}}/employees")
];

// 11. Profile
const profileFolder = getOrCreateFolder("Profile");
profileFolder.item = [
  createRequest("Get Employee Profile", "GET", "/profile/{{employeeId}}")
];

// 12. Onboarding
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
  createRequest("Update Employee Onboarding", "PATCH", "/onboarding/{{employeeId}}", {
    department: "DEPT-001",
    manager: "EMP-002",
    hr_manager: "HR-001",
    location_id: 1,
    set_as_department_head: false
  })
];

// 13. Locations
const locationsFolder = getOrCreateFolder("Locations");
locationsFolder.item = [
  createRequest("Get All Locations", "GET", "/locations"),
  createRequest("Get Location by ID", "GET", "/locations/{{locationId}}"),
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
  createRequest("Update Location", "PATCH", "/locations/{{locationId}}", {
    name: "Updated Office Name"
  }),
  createRequest("Delete Location", "DELETE", "/locations/{{locationId}}"),
  createRequest("Assign Location to Employee", "POST", "/locations/{{locationId}}/assign-employee/{{employeeId}}")
];

// 14. Users
const usersFolder = getOrCreateFolder("Users");
usersFolder.item = [
  createRequest("Get All Users", "GET", "/users"),
  createRequest("Get User Profile", "GET", "/users/profile"),
  createRequest("Get User by ID", "GET", "/users/{{userId}}"),
  createRequest("Create User", "POST", "/users", {
    username: "newuser",
    password: "password123",
    employee_id: "EMP-001",
    is_active: 1,
    role_ids: [1, 2]
  }),
  createRequest("Update User", "PATCH", "/users/{{userId}}", {
    is_active: 0,
    role_ids: [1]
  }),
  createRequest("Delete User", "DELETE", "/users/{{userId}}")
];

// 15. Roles
const rolesFolder = getOrCreateFolder("Roles");
rolesFolder.item = [
  createRequest("Get All Roles", "GET", "/roles"),
  createRequest("Get Role by ID", "GET", "/roles/{{roleId}}"),
  createRequest("Create Role", "POST", "/roles", {
    name: "Manager",
    code: "MANAGER",
    description: "Manager role",
    permissions: ["read", "write"],
    is_active: 1
  }),
  createRequest("Update Role", "PATCH", "/roles/{{roleId}}", {
    name: "Updated Role Name",
    is_active: 0
  }),
  createRequest("Delete Role", "DELETE", "/roles/{{roleId}}"),
  createRequest("Get Users with Role", "GET", "/roles/{{roleId}}/users")
];

// 16. Attendance - Shifts
const shiftsFolder = getOrCreateFolder("Attendance - Shifts");
shiftsFolder.item = [
  createRequest("Get All Shifts", "GET", "/attendance/shifts"),
  createRequest("Get Shift by ID", "GET", "/attendance/shifts/{{shiftId}}"),
  createRequest("Create Shift", "POST", "/attendance/shifts", {
    name: "Morning Shift",
    start_time: "09:00:00",
    end_time: "17:00:00",
    is_overnight: 0,
    grace_in_minutes: 15,
    default_break_minutes: 60
  }),
  createRequest("Update Shift", "PATCH", "/attendance/shifts/{{shiftId}}", {
    name: "Updated Shift Name",
    start_time: "08:00:00"
  }),
  createRequest("Delete Shift", "DELETE", "/attendance/shifts/{{shiftId}}")
];

// 17. Attendance - Shift Assignments
const shiftAssignFolder = getOrCreateFolder("Attendance - Shift Assignments");
shiftAssignFolder.item = [
  createRequest("Get Employee Shift Assignments", "GET", "/employees/{{employeeId}}/shift-assignments"),
  createRequest("Create Shift Assignment", "POST", "/employees/{{employeeId}}/shift-assignments", {
    shift_id: 1,
    effective_from: "2024-01-01",
    effective_to: "2024-12-31"
  })
];

// 18. Attendance - Policies
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
  createRequest("Update Policy", "PATCH", "/attendance/policies/{{policyId}}", {
    grace_in_minutes: 20
  })
];

// 19. Attendance - Holidays
const holidaysFolder = getOrCreateFolder("Attendance - Holidays");
holidaysFolder.item = [
  createRequest("Get All Holidays", "GET", "/holidays?year=2024"),
  createRequest("Create Holiday", "POST", "/holidays", {
    holiday_date: "2024-12-25",
    name: "Christmas",
    type: "company",
    region: null,
    is_optional: 0
  }),
  createRequest("Update Holiday", "PATCH", "/holidays/{{holidayId}}", {
    name: "Updated Holiday Name"
  }),
  createRequest("Delete Holiday", "DELETE", "/holidays/{{holidayId}}")
];

// 20. Attendance - Leaves
const leavesFolder = getOrCreateFolder("Attendance - Leaves");
leavesFolder.item = [
  createRequest("Get All Leaves", "GET", "/leaves?employee_id={{employeeId}}&from=2024-01-01&to=2024-12-31"),
  createRequest("Get Leave by ID", "GET", "/leaves/{{leaveId}}"),
  createRequest("Create Leave", "POST", "/leaves", {
    employee_id: "EMP-001",
    start_date: "2024-12-20",
    end_date: "2024-12-25",
    leave_type: "annual",
    reason: "Vacation"
  }),
  createRequest("Update Leave", "PATCH", "/leaves/{{leaveId}}", {
    status: "approved"
  }),
  createRequest("Approve Leave", "POST", "/leaves/{{leaveId}}/approve", {
    approved_by: 1
  }),
  createRequest("Reject Leave", "POST", "/leaves/{{leaveId}}/reject", {
    approved_by: 1
  })
];

// 21. Attendance - Overtime
const overtimeFolder = getOrCreateFolder("Attendance - Overtime");
overtimeFolder.item = [
  createRequest("Get All Overtime", "GET", "/overtime?employee_id={{employeeId}}"),
  createRequest("Create Overtime", "POST", "/overtime", {
    employee_id: 1,
    work_date: "2024-12-20",
    minutes: 120,
    reason: "Project deadline"
  }),
  createRequest("Update Overtime", "PATCH", "/overtime/{{overtimeId}}", {
    minutes: 180,
    reason: "Updated reason"
  }),
  createRequest("Approve Overtime", "POST", "/overtime/{{overtimeId}}/approve", {
    approved_by: 1
  }),
  createRequest("Reject Overtime", "POST", "/overtime/{{overtimeId}}/reject", {
    approved_by: 1
  })
];

// 22. Attendance - Weekly Off
const weeklyOffFolder = getOrCreateFolder("Attendance - Weekly Off");
weeklyOffFolder.item = [
  createRequest("Get Weekly Off Configurations", "GET", "/attendance/weekly-off?year=2024&month=12"),
  createRequest("Get Weekly Off by ID", "GET", "/attendance/weekly-off/{{weeklyOffId}}"),
  createRequest("Create Weekly Off", "POST", "/attendance/weekly-off", {
    year: 2024,
    month: 12,
    days_of_week: [0, 6]
  }),
  createRequest("Update Weekly Off", "PATCH", "/attendance/weekly-off/{{weeklyOffId}}", {
    days_of_week: [0, 6]
  }),
  createRequest("Delete Weekly Off", "DELETE", "/attendance/weekly-off/{{weeklyOffId}}")
];

// 23. Attendance - Records
const attendanceFolder = getOrCreateFolder("Attendance - Records");
attendanceFolder.item = [
  createRequest("Get Attendance Records", "GET", "/attendance?work_date=2024-12-20&employee_id={{employeeId}}"),
  createRequest("Clock In", "POST", "/attendance/clockin", {
    employee_id: "EMP-001",
    work_date: "2024-12-20",
    clock_in: "2024-12-20 09:00:00",
    source: "web"
  }),
  createRequest("Clock Out", "POST", "/attendance/clockout", {
    employee_id: "EMP-001",
    work_date: "2024-12-20",
    clock_out: "2024-12-20 17:00:00",
    source: "web"
  }),
  createRequest("Update Attendance Record", "PATCH", "/attendance/{{attendanceId}}", {
    status: "present",
    notes: "Updated notes"
  })
];

// 24. Attendance - Reports
const reportsFolder = getOrCreateFolder("Attendance - Reports");
reportsFolder.item = [
  createRequest("Get Daily Attendance", "GET", "/reports/attendance/daily?work_date=2024-12-20"),
  createRequest("Get Monthly Attendance", "GET", "/reports/attendance/monthly?month=2024-12&employee_id={{employeeId}}")
];

// 25. Admin
const adminFolder = getOrCreateFolder("Admin");
adminFolder.item = [
  createRequest("Get All Employees (Admin)", "GET", "/admin/employees"),
  createRequest("Get Employees (Admin)", "GET", "/admin/employees?department=1&page=1&limit=10")
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

