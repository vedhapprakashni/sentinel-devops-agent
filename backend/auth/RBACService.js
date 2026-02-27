const pool = require('../db/config');

class RBACService {
  /**
   * Create a new role
   * @param {string} name - Role name
   * @param {string} description - Role description
   * @param {string} organizationId - Organization ID
   * @param {array} permissionIds - Array of permission IDs
   * @returns {Promise<object>} - Created role
   */
  async createRole(name, description, organizationId, permissionIds = []) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create role
      const roleResult = await client.query(
        `INSERT INTO roles (name, description, organization_id, is_system_role)
         VALUES ($1, $2, $3, FALSE)
         RETURNING *`,
        [name, description, organizationId]
      );
      
      const role = roleResult.rows[0];
      
      // Assign permissions
      if (permissionIds.length > 0) {
        const values = permissionIds.map((permId, idx) => 
          `($1, $${idx + 2})`
        ).join(', ');
        
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ${values}`,
          [role.id, ...permissionIds]
        );
      }
      
      await client.query('COMMIT');
      
      return { role };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update role
   * @param {string} roleId - Role ID
   * @param {object} updates - Updates object
   * @returns {Promise<object>} - Updated role
   */
  async updateRole(roleId, updates) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update role basic info
      if (updates.name || updates.description) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        
        if (updates.name) {
          fields.push(`name = $${paramCount++}`);
          values.push(updates.name);
        }
        if (updates.description) {
          fields.push(`description = $${paramCount++}`);
          values.push(updates.description);
        }
        
        fields.push(`updated_at = NOW()`);
        values.push(roleId);
        
        await client.query(
          `UPDATE roles SET ${fields.join(', ')} WHERE id = $${paramCount}`,
          values
        );
      }
      
      // Update permissions if provided
      if (updates.permissionIds) {
        // Remove existing permissions
        await client.query(
          `DELETE FROM role_permissions WHERE role_id = $1`,
          [roleId]
        );
        
        // Add new permissions
        if (updates.permissionIds.length > 0) {
          const values = updates.permissionIds.map((permId, idx) => 
            `($1, $${idx + 2})`
          ).join(', ');
          
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ${values}`,
            [roleId, ...updates.permissionIds]
          );
        }
      }
      
      // Get updated role
      const roleResult = await client.query(
        `SELECT * FROM roles WHERE id = $1`,
        [roleId]
      );
      
      await client.query('COMMIT');
      
      return { role: roleResult.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete role (only if no users assigned and not a system role)
   * @param {string} roleId - Role ID
   * @throws {Error} - If role has users assigned or is a system role
   */
  async deleteRole(roleId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Atomically check and delete role
      const result = await client.query(
        `DELETE FROM roles 
         WHERE id = $1 
         AND NOT is_system_role 
         AND NOT EXISTS (SELECT 1 FROM user_roles WHERE role_id = $1)
         RETURNING id, is_system_role`,
        [roleId]
      );
      
      if (result.rows.length === 0) {
        // Check why deletion failed
        const checkResult = await client.query(
          `SELECT is_system_role, 
                  EXISTS(SELECT 1 FROM user_roles WHERE role_id = $1) as has_users
           FROM roles WHERE id = $1`,
          [roleId]
        );
        
        if (checkResult.rows.length === 0) {
          throw new Error('Role not found');
        }
        
        const roleInfo = checkResult.rows[0];
        if (roleInfo.is_system_role) {
          throw new Error('Cannot delete system role');
        }
        if (roleInfo.has_users) {
          throw new Error('Cannot delete role with assigned users');
        }
      }
      
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all roles for organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<array>} - Array of roles
   */
  async getRoles(organizationId) {
    const result = await pool.query(
      `SELECT r.*, 
              COALESCE(
                json_agg(
                  json_build_object('id', p.id, 'name', p.name, 'resource', p.resource, 'action', p.action)
                ) FILTER (WHERE p.id IS NOT NULL), 
                '[]'
              ) as permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE r.organization_id = $1
       GROUP BY r.id
       ORDER BY r.is_system_role DESC, r.name`,
      [organizationId]
    );
    
    return { roles: result.rows };
  }

  /**
   * Assign role to user
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   */
  async assignRole(userId, roleId) {
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, roleId]
    );
    
    return { success: true };
  }

  /**
   * Remove role from user
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   */
  async removeRole(userId, roleId) {
    await pool.query(
      `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId]
    );
    
    return { success: true };
  }

  /**
   * Get user's permissions (aggregated from all roles)
   * @param {string} userId - User ID
   * @returns {Promise<array>} - Array of permission names
   */
  async getUserPermissions(userId) {
    const result = await pool.query(
      `SELECT DISTINCT p.name
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );
    
    return { permissions: result.rows.map(r => r.name) };
  }

  /**
   * Check if user has specific permission
   * @param {string} userId - User ID
   * @param {string} permission - Permission name
   * @returns {Promise<boolean>} - True if user has permission
   */
  async hasPermission(userId, permission) {
    const result = await pool.query(
      `SELECT EXISTS(
         SELECT 1
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = $1 AND p.name = $2
       ) as has_permission`,
      [userId, permission]
    );
    
    return result.rows[0].has_permission;
  }

  /**
   * Check if user has all permissions (AND logic)
   * @param {string} userId - User ID
   * @param {array} permissions - Array of permission names
   * @returns {Promise<boolean>} - True if user has all permissions
   */
  async hasAllPermissions(userId, permissions) {
    if (permissions.length === 0) return true;
    
    const result = await pool.query(
      `SELECT COUNT(DISTINCT p.name) as count
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1 AND p.name = ANY($2)`,
      [userId, permissions]
    );
    
    return parseInt(result.rows[0].count) === permissions.length;
  }

  /**
   * Check if user has any permission (OR logic)
   * @param {string} userId - User ID
   * @param {array} permissions - Array of permission names
   * @returns {Promise<boolean>} - True if user has at least one permission
   */
  async hasAnyPermission(userId, permissions) {
    if (permissions.length === 0) return false;
    
    const result = await pool.query(
      `SELECT EXISTS(
         SELECT 1
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = $1 AND p.name = ANY($2)
       ) as has_any`,
      [userId, permissions]
    );
    
    return result.rows[0].has_any;
  }

  /**
   * Get all available permissions
   * @returns {Promise<array>} - Array of permissions
   */
  async getAvailablePermissions() {
    const result = await pool.query(
      `SELECT * FROM permissions ORDER BY resource, action`
    );
    
    return { permissions: result.rows };
  }

  /**
   * Initialize system roles for organization
   * @param {string} organizationId - Organization ID
   * @param {object} client - Optional database client for transaction
   * @returns {Promise<object>} - Created roles
   */
  async initializeSystemRoles(organizationId, client = null) {
    const shouldManageTransaction = !client;
    const dbClient = client || await pool.connect();
    
    try {
      if (shouldManageTransaction) {
        await dbClient.query('BEGIN');
      }
      
      // Get all permissions
      const permissionsResult = await dbClient.query(`SELECT * FROM permissions`);
      const allPermissions = permissionsResult.rows;
      
      // Admin role - all permissions
      const adminResult = await dbClient.query(
        `INSERT INTO roles (name, description, organization_id, is_system_role)
         VALUES ($1, $2, $3, TRUE)
         RETURNING *`,
        ['Admin', 'Full system access with all permissions', organizationId]
      );
      const adminRole = adminResult.rows[0];
      
      // Assign all permissions to Admin
      for (const perm of allPermissions) {
        await dbClient.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
          [adminRole.id, perm.id]
        );
      }
      
      // Operator role
      const operatorResult = await dbClient.query(
        `INSERT INTO roles (name, description, organization_id, is_system_role)
         VALUES ($1, $2, $3, TRUE)
         RETURNING *`,
        ['Operator', 'Can manage containers, alerts, and logs', organizationId]
      );
      const operatorRole = operatorResult.rows[0];
      
      // Assign Operator permissions
      const operatorPerms = allPermissions.filter(p => 
        ['containers:read', 'containers:write', 'containers:restart',
         'alerts:read', 'alerts:write', 'alerts:acknowledge',
         'logs:read', 'logs:export'].includes(p.name)
      );
      
      for (const perm of operatorPerms) {
        await dbClient.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
          [operatorRole.id, perm.id]
        );
      }
      
      // Viewer role
      const viewerResult = await dbClient.query(
        `INSERT INTO roles (name, description, organization_id, is_system_role)
         VALUES ($1, $2, $3, TRUE)
         RETURNING *`,
        ['Viewer', 'Read-only access to containers, alerts, and logs', organizationId]
      );
      const viewerRole = viewerResult.rows[0];
      
      // Assign Viewer permissions
      const viewerPerms = allPermissions.filter(p => 
        ['containers:read', 'alerts:read', 'logs:read'].includes(p.name)
      );
      
      for (const perm of viewerPerms) {
        await dbClient.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
          [viewerRole.id, perm.id]
        );
      }
      
      if (shouldManageTransaction) {
        await dbClient.query('COMMIT');
      }
      
      return {
        roles: [adminRole, operatorRole, viewerRole]
      };
    } catch (error) {
      if (shouldManageTransaction) {
        await dbClient.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        dbClient.release();
      }
    }
  }
}

module.exports = new RBACService();
