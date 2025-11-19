const fs = require('fs');
const path = require('path');

// Base collection structure
const collection = {
  info: {
    name: "EMS Backend",
    _postman_id: "f8e1e9e9-0000-4000-9000-ems-backend",
    description: "Postman collection for EMS Backend APIs (multi-tenant via X-Org-Id).\n\n**Important Notes:**\n- When creating employees, use `employee_code` (VARCHAR) in the request body\n- Employee endpoints accept both numeric IDs and employee codes in URLs (e.g., `/employees/123` or `/employees/E-001`)\n- Other endpoints use `employee_id` which refers to the numeric foreign key (BIGINT) to `employees.id`\n- **Authentication:** Login first to get a token, then all authenticated requests will automatically include the Authorization header",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  auth: {
    type: "bearer",
    bearer: [
      {
        key: "token",
        value: "{{token}}",
        type: "string"
      }
    ]
  },
  event: [
    {
      listen: "prerequest",
      script: {
        exec: [
          "// Auto-add Authorization header for authenticated requests",
          "const path = pm.request.url.getPath();",
          "const publicPaths = ['/auth/login', '/auth/register', '/auth/updatePassword'];",
          "const isPublicPath = publicPaths.some(publicPath => path.includes(publicPath));",
          "",
          "// For public paths, explicitly remove auth header",
          "if (isPublicPath) {",
          "    pm.request.headers.remove('Authorization');",
          "    console.log('🌐 Public endpoint - auth header removed');",
          "} else {",
          "    // For protected paths, ensure Authorization header is set",
          "    const token = pm.collectionVariables.get('token') || pm.environment.get('token');",
          "    ",
          "    if (token && token.trim() !== '') {",
          "        // Check if Authorization header already exists",
          "        const existingAuth = pm.request.headers.get('Authorization');",
          "        ",
          "        if (existingAuth && existingAuth.includes('Bearer')) {",
          "            // Header exists, update it if token changed",
          "            const currentToken = existingAuth.replace('Bearer ', '').trim();",
          "            if (currentToken !== token.trim()) {",
          "                pm.request.headers.remove('Authorization');",
          "                pm.request.headers.add({",
          "                    key: 'Authorization',",
          "                    value: 'Bearer ' + token.trim()",
          "                });",
          "                console.log('🔄 Authorization header updated for: ' + pm.request.method + ' ' + path);",
          "            } else {",
          "                console.log('✅ Authorization header already set for: ' + pm.request.method + ' ' + path);",
          "            }",
          "        } else {",
          "            // No header exists, add it",
          "            pm.request.headers.remove('Authorization');",
          "            pm.request.headers.add({",
          "                key: 'Authorization',",
          "                value: 'Bearer ' + token.trim()",
          "            });",
          "            console.log('🔐 Authorization header added for: ' + pm.request.method + ' ' + path);",
          "        }",
          "    } else {",
          "        // Remove auth header if no token",
          "        pm.request.headers.remove('Authorization');",
          "        console.log('⚠️ No token found. Please login first. Request: ' + pm.request.method + ' ' + path);",
          "    }",
          "}"
        ],
        type: "text/javascript"
      }
    }
  ],
  item: []
};

// Helper function to create a request
function createRequest(name, method, path, body = null, auth = null, description = "") {
  const request = {
    name: name,
    request: {
      method: method,
      header: [
        { key: "Content-Type", value: "application/json" },
        { key: "X-Org-Id", value: "{{orgId}}" }
      ],
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ["{{baseUrl}}"],
        path: path.split('/').filter(p => p)
      }
    }
  };

  if (auth === "noauth") {
    request.request.auth = { type: "noauth" };
    request.request.header = request.request.header.filter(h => h.key !== "X-Org-Id");
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

// Authentication routes
const authFolder = {
  name: "Authentication",
  item: [
    createRequest("Login", "POST", "/auth/login", {
      username: "testuser@example.com",
      password: "password123"
    }, "noauth", "Login and get JWT token"),
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
  ]
};

// Add test script to Login
authFolder.item[0].event = [{
  listen: "test",
  script: {
    exec: [
      "if (pm.response.code === 200) {",
      "    var jsonData = pm.response.json();",
      "    if (jsonData.token) {",
      "        // Save token to collection variables",
      "        pm.collectionVariables.set('token', jsonData.token);",
      "        ",
      "        // Save organization ID (using organization_id from user object)",
      "        if (jsonData.user && jsonData.user.organization_id) {",
      "            pm.collectionVariables.set('orgId', jsonData.user.organization_id);",
      "            pm.environment.set('orgId', jsonData.user.organization_id);",
      "        }",
      "        ",
      "        // Also save to environment for convenience",
      "        pm.environment.set('token', jsonData.token);",
      "        ",
      "        console.log('✅ Token and organization ID saved successfully');",
      "        console.log('Token:', jsonData.token.substring(0, 20) + '...');",
      "        console.log('Organization ID:', jsonData.user.organization_id);",
      "    } else {",
      "        console.log('⚠️ No token in response');",
      "    }",
      "} else {",
      "    console.log('❌ Login failed with status:', pm.response.code);",
      "}"
    ],
    type: "text/javascript"
  }
}];

collection.item.push(authFolder);

// Organizations (public)
const orgFolder = {
  name: "Organizations",
  item: [
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
  ]
};
collection.item.push(orgFolder);

// Employees
const employeesFolder = {
  name: "Employees",
  item: [
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
  ]
};
collection.item.push(employeesFolder);

// Departments
const departmentsFolder = {
  name: "Departments",
  item: [
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
  ]
};
collection.item.push(departmentsFolder);

// Department HR Managers
const deptHrManagersFolder = {
  name: "Department HR Managers",
  item: [
    createRequest("Get HR Managers for Department", "GET", "/departments/{{departmentId}}/hr-managers"),
    createRequest("Add HR Manager to Department", "POST", "/departments/{{departmentId}}/hr-managers", {
      hr_manager: "HR-001"
    }),
    createRequest("Remove HR Manager from Department", "DELETE", "/departments/{{departmentId}}/hr-managers/{{hrManagerId}}")
  ]
};
collection.item.push(deptHrManagersFolder);

// Profile
const profileFolder = {
  name: "Profile",
  item: [
    createRequest("Get Employee Profile", "GET", "/profile/{{employeeId}}")
  ]
};
collection.item.push(profileFolder);

// Onboarding
const onboardingFolder = {
  name: "Onboarding",
  item: [
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
  ]
};
collection.item.push(onboardingFolder);

// Attendance - Weekly Off
const weeklyOffFolder = {
  name: "Attendance - Weekly Off",
  item: [
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
  ]
};
collection.item.push(weeklyOffFolder);

// Write collection to file
fs.writeFileSync(
  'postman/ems-backend.postman_collection.json',
  JSON.stringify(collection, null, 2)
);

console.log('✅ Postman collection regenerated successfully!');
console.log('📁 Collection includes:');
console.log('   - Authentication (Login, Register, Update Password)');
console.log('   - Organizations (GET, POST, PATCH)');
console.log('   - Employees (GET, POST, PATCH, Available HR Managers)');
console.log('   - Departments (GET, POST, PATCH, DELETE)');
console.log('   - Department HR Managers');
console.log('   - Profile');
console.log('   - Onboarding');
console.log('   - Attendance - Weekly Off');
console.log('\n🔐 Authentication is automatically handled via pre-request script');
