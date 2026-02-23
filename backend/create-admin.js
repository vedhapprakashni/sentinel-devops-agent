// Load environment variables
require('dotenv').config();

const pool = require('./db/config');
const AuthService = require('./auth/AuthService');

async function createAdminUser() {
  console.log('🔧 Creating admin user...\n');
  
  try {
    // Check if admin user already exists
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      ['admin@example.com']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Email: admin@example.com');
      console.log('   Password: password123');
      console.log('\n✅ You can use these credentials to login.\n');
      process.exit(0);
    }
    
    // Hash password
    const passwordHash = await AuthService.hashPassword('password123');
    
    // Create admin user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, organization_id)
       VALUES ($1, $2, $3)
       RETURNING id, email`,
      ['admin@example.com', passwordHash, '00000000-0000-0000-0000-000000000001']
    );
    
    const userId = userResult.rows[0].id;
    console.log('✅ Admin user created successfully!');
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: admin@example.com`);
    
    // Get Admin role ID
    const roleResult = await pool.query(
      `SELECT id FROM roles 
       WHERE name = 'Admin' AND organization_id = '00000000-0000-0000-0000-000000000001'`
    );
    
    if (roleResult.rows.length === 0) {
      console.log('❌ Admin role not found. Please run migrations first: npm run db:setup');
      process.exit(1);
    }
    
    const roleId = roleResult.rows[0].id;
    
    // Assign Admin role
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [userId, roleId]
    );
    
    console.log('✅ Admin role assigned successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Email: admin@example.com');
    console.log('   Password: password123');
    console.log('\n⚠️  IMPORTANT: Change this password in production!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    
    if (error.code === '23503') {
      console.error('\n💡 Hint: The default organization might not exist.');
      console.error('   Please run migrations first: npm run db:setup\n');
    }
    
    process.exit(1);
  }
}

createAdminUser();
