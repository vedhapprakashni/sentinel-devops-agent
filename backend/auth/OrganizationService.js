const pool = require('../db/config');
const RBACService = require('./RBACService');

class OrganizationService {
  /**
   * Create new organization
   * @param {string} name - Organization name
   * @returns {Promise<object>} - Created organization
   */
  async createOrganization(name) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create organization
      const result = await client.query(
        `INSERT INTO organizations (name) VALUES ($1) RETURNING *`,
        [name]
      );
      
      const organization = result.rows[0];
      
      // Initialize system roles for the organization (pass client for transaction)
      await RBACService.initializeSystemRoles(organization.id, client);
      
      await client.query('COMMIT');
      
      return { organization };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update organization
   * @param {string} orgId - Organization ID
   * @param {object} updates - Updates object
   * @returns {Promise<object>} - Updated organization
   */
  async updateOrganization(orgId, updates) {
    const result = await pool.query(
      `UPDATE organizations 
       SET name = COALESCE($1, name), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [updates.name, orgId]
    );
    
    return { organization: result.rows[0] };
  }

  /**
   * Delete organization (only if no users or teams)
   * @param {string} orgId - Organization ID
   * @throws {Error} - If organization has users or teams
   */
  async deleteOrganization(orgId) {
    // Check for users
    const usersResult = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE organization_id = $1`,
      [orgId]
    );
    
    if (parseInt(usersResult.rows[0].count) > 0) {
      throw new Error('Cannot delete organization with users');
    }
    
    // Check for teams
    const teamsResult = await pool.query(
      `SELECT COUNT(*) as count FROM teams WHERE organization_id = $1`,
      [orgId]
    );
    
    if (parseInt(teamsResult.rows[0].count) > 0) {
      throw new Error('Cannot delete organization with teams');
    }
    
    // Delete organization
    await pool.query(
      `DELETE FROM organizations WHERE id = $1`,
      [orgId]
    );
    
    return { success: true };
  }

  /**
   * Get organization by ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<object>} - Organization
   */
  async getOrganization(orgId) {
    const result = await pool.query(
      `SELECT * FROM organizations WHERE id = $1`,
      [orgId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }
    
    return { organization: result.rows[0] };
  }

  /**
   * Get all users in organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<array>} - Array of users
   */
  async getOrganizationUsers(orgId) {
    const result = await pool.query(
      `SELECT id, email, organization_id, created_at, updated_at
       FROM users
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [orgId]
    );
    
    return { users: result.rows };
  }

  /**
   * Get all teams in organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<array>} - Array of teams
   */
  async getOrganizationTeams(orgId) {
    const result = await pool.query(
      `SELECT * FROM teams WHERE organization_id = $1 ORDER BY name`,
      [orgId]
    );
    
    return { teams: result.rows };
  }

  /**
   * Check if user belongs to organization
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<boolean>} - True if user belongs to organization
   */
  async userBelongsToOrg(userId, orgId) {
    const result = await pool.query(
      `SELECT EXISTS(
         SELECT 1 FROM users WHERE id = $1 AND organization_id = $2
       ) as belongs`,
      [userId, orgId]
    );
    
    return result.rows[0].belongs;
  }
}

module.exports = new OrganizationService();
