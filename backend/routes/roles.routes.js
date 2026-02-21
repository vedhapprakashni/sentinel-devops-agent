const express = require('express');
const router = express.Router();
const RBACService = require('../auth/RBACService');
const AuditService = require('../auth/AuditService');
const { requireAuth, requirePermissions } = require('../auth/middleware');

/**
 * GET /api/roles
 * Get all roles for organization
 */
router.get('/', requireAuth, requirePermissions('roles:read'), async (req, res) => {
  try {
    const result = await RBACService.getRoles(req.user.organizationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/roles
 * Create new role
 */
router.post('/', requireAuth, requirePermissions('roles:write'), async (req, res) => {
  try {
    const { name, description, permissionIds } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    
    const result = await RBACService.createRole(
      name,
      description,
      req.user.organizationId,
      permissionIds || []
    );
    
    // Log role creation
    await AuditService.logEvent(
      req.user.userId,
      'ROLE_CREATED',
      'role',
      result.role.id,
      { name, description, permissionIds },
      req.ip || req.connection.remoteAddress
    );
    
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/roles/:id
 * Update role
 */
router.put('/:id', requireAuth, requirePermissions('roles:write'), async (req, res) => {
  try {
    const { name, description, permissionIds } = req.body;
    
    const result = await RBACService.updateRole(req.params.id, {
      name,
      description,
      permissionIds
    });
    
    // Log role modification
    await AuditService.logEvent(
      req.user.userId,
      'ROLE_UPDATED',
      'role',
      req.params.id,
      { name, description, permissionIds },
      req.ip || req.connection.remoteAddress
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/roles/:id
 * Delete role
 */
router.delete('/:id', requireAuth, requirePermissions('roles:delete'), async (req, res) => {
  try {
    await RBACService.deleteRole(req.params.id);
    
    // Log role deletion
    await AuditService.logEvent(
      req.user.userId,
      'ROLE_DELETED',
      'role',
      req.params.id,
      {},
      req.ip || req.connection.remoteAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    if (error.message.includes('assigned users')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/permissions
 * Get all available permissions
 */
router.get('/permissions', requireAuth, requirePermissions('roles:read'), async (req, res) => {
  try {
    const result = await RBACService.getAvailablePermissions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
