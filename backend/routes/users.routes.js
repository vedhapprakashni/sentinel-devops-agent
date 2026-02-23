const express = require('express');
const router = express.Router();
const pool = require('../db/config');
const AuthService = require('../auth/AuthService');
const RBACService = require('../auth/RBACService');
const AuditService = require('../auth/AuditService');
const { requireAuth, requirePermissions, requireOrganization } = require('../auth/middleware');

/**
 * POST /api/users
 * Create new user
 */
router.post('/', requireAuth, requirePermissions('users:write'), async (req, res) => {
  try {
    const { email, password, organizationId, roleIds } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Use requester's organization if not specified
    const targetOrgId = organizationId || req.user.organizationId;
    
    // Verify requester has access to target organization
    if (targetOrgId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Cannot create user in different organization' });
    }
    
    // Hash password
    const passwordHash = await AuthService.hashPassword(password);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, organization_id)
       VALUES ($1, $2, $3)
       RETURNING id, email, organization_id, created_at, updated_at`,
      [email, passwordHash, targetOrgId]
    );
    
    const user = result.rows[0];
    
    // Assign roles if provided
    if (roleIds && roleIds.length > 0) {
      // Validate all roles exist and belong to target organization
      const rolesResult = await pool.query(
        `SELECT id, organization_id FROM roles WHERE id = ANY($1)`,
        [roleIds]
      );
      
      if (rolesResult.rows.length !== roleIds.length) {
        return res.status(400).json({ error: 'One or more roles not found' });
      }
      
      const invalidRoles = rolesResult.rows.filter(r => r.organization_id !== targetOrgId);
      if (invalidRoles.length > 0) {
        return res.status(403).json({ error: 'Cannot assign roles from different organization' });
      }
      
      // All roles validated, assign them
      for (const roleId of roleIds) {
        await RBACService.assignRole(user.id, roleId);
      }
    }
    
    // Log user creation
    await AuditService.logEvent(
      req.user.userId,
      'USER_CREATED',
      'user',
      user.id,
      { email, organizationId: targetOrgId },
      req.ip || req.connection.remoteAddress
    );
    
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users
 * Get all users in organization
 */
router.get('/', requireAuth, requirePermissions('users:read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.organization_id, u.created_at, u.updated_at,
              COALESCE(
                json_agg(
                  json_build_object('id', r.id, 'name', r.name)
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.organization_id = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [req.user.organizationId]
    );
    
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:id
 * Get specific user
 */
router.get('/:id', requireAuth, requirePermissions('users:read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.organization_id, u.created_at, u.updated_at,
              COALESCE(
                json_agg(
                  json_build_object('id', r.id, 'name', r.name, 'description', r.description)
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1 AND u.organization_id = $2
       GROUP BY u.id`,
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', requireAuth, requirePermissions('users:write'), async (req, res) => {
  try {
    const { email } = req.body;
    
    // Verify user belongs to same organization
    const checkResult = await pool.query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [req.params.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (checkResult.rows[0].organization_id !== req.user.organizationId) {
      return res.status(403).json({ error: 'Cannot modify user from different organization' });
    }
    
    // Update user
    const result = await pool.query(
      `UPDATE users
       SET email = COALESCE($1, email), updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, organization_id, created_at, updated_at`,
      [email, req.params.id]
    );
    
    // Log user modification
    await AuditService.logEvent(
      req.user.userId,
      'USER_UPDATED',
      'user',
      req.params.id,
      { email },
      req.ip || req.connection.remoteAddress
    );
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', requireAuth, requirePermissions('users:delete'), async (req, res) => {
  try {
    // Verify user belongs to same organization
    const checkResult = await pool.query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [req.params.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (checkResult.rows[0].organization_id !== req.user.organizationId) {
      return res.status(403).json({ error: 'Cannot delete user from different organization' });
    }
    
    // Prevent self-deletion
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete user
    await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    
    // Log user deletion
    await AuditService.logEvent(
      req.user.userId,
      'USER_DELETED',
      'user',
      req.params.id,
      {},
      req.ip || req.connection.remoteAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/users/:id/roles
 * Assign role to user
 */
router.post('/:id/roles', requireAuth, requirePermissions('users:write', 'roles:read'), async (req, res) => {
  try {
    const { roleId } = req.body;
    
    if (!roleId) {
      return res.status(400).json({ error: 'Role ID is required' });
    }
    
    // Verify user belongs to same organization
    const userResult = await pool.query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [req.params.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userResult.rows[0].organization_id !== req.user.organizationId) {
      return res.status(403).json({ error: 'Cannot modify user from different organization' });
    }
    
    // Verify role exists and belongs to same organization
    const roleResult = await pool.query(
      `SELECT organization_id FROM roles WHERE id = $1`,
      [roleId]
    );
    
    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    if (roleResult.rows[0].organization_id !== req.user.organizationId) {
      return res.status(403).json({ error: 'Cannot assign role from different organization' });
    }
    
    // Assign role
    await RBACService.assignRole(req.params.id, roleId);
    
    // Log role assignment
    await AuditService.logEvent(
      req.user.userId,
      'ROLE_ASSIGNED',
      'user',
      req.params.id,
      { roleId },
      req.ip || req.connection.remoteAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/users/:id/roles/:roleId
 * Remove role from user
 */
router.delete('/:id/roles/:roleId', requireAuth, requirePermissions('users:write', 'roles:read'), async (req, res) => {
  try {
    // Verify user belongs to same organization
    const userResult = await pool.query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [req.params.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userResult.rows[0].organization_id !== req.user.organizationId) {
      return res.status(403).json({ error: 'Cannot modify user from different organization' });
    }
    
    // Remove role
    await RBACService.removeRole(req.params.id, req.params.roleId);
    
    // Log role removal
    await AuditService.logEvent(
      req.user.userId,
      'ROLE_REMOVED',
      'user',
      req.params.id,
      { roleId: req.params.roleId },
      req.ip || req.connection.remoteAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
