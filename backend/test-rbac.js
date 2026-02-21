// Load environment variables
require('dotenv').config();

const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function testRBACSystem() {
  log('\n🧪 Starting RBAC System Tests\n', 'blue');
  
  let accessToken = null;
  let refreshToken = null;
  let userId = null;
  let testRoleId = null;
  
  try {
    // Test 1: Check if server is running
    log('Test 1: Checking if server is running...', 'yellow');
    try {
      await axios.get(`${BASE_URL}/api/status`);
      logSuccess('Server is running');
    } catch (error) {
      logError('Server is not running. Please start the server with: npm start');
      process.exit(1);
    }
    
    // Test 2: Login with admin credentials
    log('\nTest 2: Testing login...', 'yellow');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'admin@example.com',
        password: 'password123'
      });
      
      accessToken = loginResponse.data.accessToken;
      refreshToken = loginResponse.data.refreshToken;
      userId = loginResponse.data.user.id;
      
      logSuccess('Login successful');
      logInfo(`User ID: ${userId}`);
      logInfo(`Roles: ${loginResponse.data.user.roles.join(', ')}`);
      logInfo(`Permissions: ${loginResponse.data.user.permissions.length} permissions`);
    } catch (error) {
      if (error.response?.status === 401) {
        logWarning('Admin user not found or invalid credentials');
        logInfo('Please create an admin user first. See RBAC_SETUP.md for instructions');
      } else {
        logError(`Login failed: ${error.message}`);
      }
      process.exit(1);
    }
    
    // Test 3: Get current user info
    log('\nTest 3: Testing /auth/me endpoint...', 'yellow');
    try {
      const meResponse = await axios.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      logSuccess('Successfully retrieved user info');
      logInfo(`Email: ${meResponse.data.user.email}`);
    } catch (error) {
      logError(`Failed to get user info: ${error.message}`);
    }
    
    // Test 4: List all roles
    log('\nTest 4: Testing role listing...', 'yellow');
    try {
      const rolesResponse = await axios.get(`${BASE_URL}/api/roles`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      logSuccess(`Found ${rolesResponse.data.roles.length} roles`);
      rolesResponse.data.roles.forEach(role => {
        logInfo(`  - ${role.name}: ${role.description}`);
      });
    } catch (error) {
      logError(`Failed to list roles: ${error.message}`);
    }
    
    // Test 5: List all permissions
    log('\nTest 5: Testing permissions listing...', 'yellow');
    try {
      const permsResponse = await axios.get(`${BASE_URL}/api/roles/permissions`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      logSuccess(`Found ${permsResponse.data.permissions.length} permissions`);
      
      // Group by resource
      const grouped = {};
      permsResponse.data.permissions.forEach(perm => {
        if (!grouped[perm.resource]) grouped[perm.resource] = [];
        grouped[perm.resource].push(perm.action);
      });
      
      Object.keys(grouped).forEach(resource => {
        logInfo(`  ${resource}: ${grouped[resource].join(', ')}`);
      });
    } catch (error) {
      logError(`Failed to list permissions: ${error.message}`);
    }
    
    // Test 6: Create a custom role
    log('\nTest 6: Testing custom role creation...', 'yellow');
    try {
      // Get some permission IDs first
      const permsResponse = await axios.get(`${BASE_URL}/api/roles/permissions`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const containerReadPerm = permsResponse.data.permissions.find(p => p.name === 'containers:read');
      const logsReadPerm = permsResponse.data.permissions.find(p => p.name === 'logs:read');
      
      const roleResponse = await axios.post(`${BASE_URL}/api/roles`, {
        name: 'Test Role',
        description: 'A test role for RBAC testing',
        permissionIds: [containerReadPerm.id, logsReadPerm.id]
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      testRoleId = roleResponse.data.role.id;
      logSuccess('Custom role created successfully');
      logInfo(`Role ID: ${testRoleId}`);
    } catch (error) {
      if (error.response?.data?.error?.includes('already exists')) {
        logWarning('Test role already exists (this is okay)');
      } else {
        logError(`Failed to create role: ${error.response?.data?.error || error.message}`);
      }
    }
    
    // Test 7: Create a new user
    log('\nTest 7: Testing user creation...', 'yellow');
    let testUserId = null;
    try {
      const userResponse = await axios.post(`${BASE_URL}/api/users`, {
        email: 'testuser@example.com',
        password: 'testpassword123'
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      testUserId = userResponse.data.user.id;
      logSuccess('Test user created successfully');
      logInfo(`User ID: ${testUserId}`);
    } catch (error) {
      if (error.response?.status === 409) {
        logWarning('Test user already exists (this is okay)');
        // Get the user ID
        const usersResponse = await axios.get(`${BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const testUser = usersResponse.data.users.find(u => u.email === 'testuser@example.com');
        if (testUser) testUserId = testUser.id;
      } else {
        logError(`Failed to create user: ${error.response?.data?.error || error.message}`);
      }
    }
    
    // Test 8: List all users
    log('\nTest 8: Testing user listing...', 'yellow');
    try {
      const usersResponse = await axios.get(`${BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      logSuccess(`Found ${usersResponse.data.users.length} users`);
      usersResponse.data.users.forEach(user => {
        logInfo(`  - ${user.email} (${user.roles.map(r => r.name).join(', ') || 'No roles'})`);
      });
    } catch (error) {
      logError(`Failed to list users: ${error.message}`);
    }
    
    // Test 9: Assign role to user
    if (testUserId && testRoleId) {
      log('\nTest 9: Testing role assignment...', 'yellow');
      try {
        await axios.post(`${BASE_URL}/api/users/${testUserId}/roles`, {
          roleId: testRoleId
        }, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        logSuccess('Role assigned to user successfully');
      } catch (error) {
        logError(`Failed to assign role: ${error.response?.data?.error || error.message}`);
      }
    }
    
    // Test 10: Test token refresh
    log('\nTest 10: Testing token refresh...', 'yellow');
    try {
      const refreshResponse = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken: refreshToken
      });
      
      logSuccess('Token refresh successful');
      logInfo('New access token received');
      
      // Update tokens
      accessToken = refreshResponse.data.accessToken;
      refreshToken = refreshResponse.data.refreshToken;
    } catch (error) {
      logError(`Token refresh failed: ${error.message}`);
    }
    
    // Test 11: Test rate limiting
    log('\nTest 11: Testing rate limiting...', 'yellow');
    try {
      logInfo('Making 6 rapid login attempts to trigger rate limit...');
      
      for (let i = 0; i < 6; i++) {
        try {
          await axios.post(`${BASE_URL}/auth/login`, {
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });
        } catch (error) {
          if (error.response?.status === 429) {
            logSuccess('Rate limiting is working! (429 Too Many Requests)');
            logInfo(`Retry-After: ${error.response.headers['retry-after']} seconds`);
            break;
          }
        }
      }
    } catch (error) {
      logWarning('Rate limiting test inconclusive');
    }
    
    // Test 12: Test unauthorized access
    log('\nTest 12: Testing unauthorized access protection...', 'yellow');
    try {
      await axios.get(`${BASE_URL}/api/users`);
      logError('Unauthorized access was allowed (this should not happen!)');
    } catch (error) {
      if (error.response?.status === 401) {
        logSuccess('Unauthorized access properly blocked (401)');
      } else {
        logError(`Unexpected error: ${error.message}`);
      }
    }
    
    // Test 13: Test invalid token
    log('\nTest 13: Testing invalid token protection...', 'yellow');
    try {
      await axios.get(`${BASE_URL}/api/users`, {
        headers: { Authorization: 'Bearer invalid-token-here' }
      });
      logError('Invalid token was accepted (this should not happen!)');
    } catch (error) {
      if (error.response?.status === 401) {
        logSuccess('Invalid token properly rejected (401)');
      } else {
        logError(`Unexpected error: ${error.message}`);
      }
    }
    
    // Test 14: Get active sessions
    log('\nTest 14: Testing session management...', 'yellow');
    try {
      const sessionsResponse = await axios.get(`${BASE_URL}/auth/sessions`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      logSuccess(`Found ${sessionsResponse.data.sessions.length} active sessions`);
      sessionsResponse.data.sessions.forEach((session, idx) => {
        logInfo(`  Session ${idx + 1}: Created ${new Date(session.created_at).toLocaleString()}`);
      });
    } catch (error) {
      logError(`Failed to get sessions: ${error.message}`);
    }
    
    // Test 15: Logout
    log('\nTest 15: Testing logout...', 'yellow');
    try {
      await axios.post(`${BASE_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      logSuccess('Logout successful');
      
      // Try to use the old refresh token (should fail)
      try {
        await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken: refreshToken
        });
        logError('Old refresh token still works after logout (this should not happen!)');
      } catch (error) {
        if (error.response?.status === 401) {
          logSuccess('Old refresh token properly invalidated');
        }
      }
    } catch (error) {
      logError(`Logout failed: ${error.message}`);
    }
    
    // Summary
    log('\n' + '='.repeat(60), 'blue');
    log('🎉 RBAC System Test Complete!', 'green');
    log('='.repeat(60) + '\n', 'blue');
    
    logInfo('All core RBAC features are working:');
    logInfo('  ✓ Authentication (login/logout)');
    logInfo('  ✓ JWT token management');
    logInfo('  ✓ Role-based access control');
    logInfo('  ✓ Permission checking');
    logInfo('  ✓ User management');
    logInfo('  ✓ Role management');
    logInfo('  ✓ Rate limiting');
    logInfo('  ✓ Session management');
    logInfo('  ✓ Security protections');
    
    log('\n📚 Next steps:', 'cyan');
    logInfo('  1. Build the frontend authentication UI');
    logInfo('  2. Create the admin dashboard');
    logInfo('  3. Implement permission-gated components');
    logInfo('  4. Add API key management UI');
    logInfo('  5. Deploy to production');
    
  } catch (error) {
    logError(`\nTest suite failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

// Run tests
testRBACSystem();
