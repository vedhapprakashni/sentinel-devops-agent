const pool = require('../db/config');

class TeamService {
  /**
   * Create team
   * @param {string} name - Team name
   * @param {string} organizationId - Organization ID
   * @returns {Promise<object>} - Created team
   */
  async createTeam(name, organizationId) {
    const result = await pool.query(
      `INSERT INTO teams (name, organization_id) VALUES ($1, $2) RETURNING *`,
      [name, organizationId]
    );
    
    return { team: result.rows[0] };
  }

  /**
   * Update team
   * @param {string} teamId - Team ID
   * @param {object} updates - Updates object
   * @returns {Promise<object>} - Updated team
   */
  async updateTeam(teamId, updates) {
    const result = await pool.query(
      `UPDATE teams 
       SET name = COALESCE($1, name), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [updates.name, teamId]
    );
    
    return { team: result.rows[0] };
  }

  /**
   * Delete team
   * @param {string} teamId - Team ID
   */
  async deleteTeam(teamId) {
    await pool.query(
      `DELETE FROM teams WHERE id = $1`,
      [teamId]
    );
    
    return { success: true };
  }

  /**
   * Add user to team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @throws {Error} - If user and team are in different organizations
   */
  async addMember(teamId, userId) {
    // Verify user and team are in same organization
    const result = await pool.query(
      `SELECT 
         (SELECT organization_id FROM teams WHERE id = $1) as team_org,
         (SELECT organization_id FROM users WHERE id = $2) as user_org`,
      [teamId, userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].team_org || !result.rows[0].user_org) {
      throw new Error('Team or user not found');
    }
    
    if (result.rows[0].team_org !== result.rows[0].user_org) {
      throw new Error('User and team must be in the same organization');
    }
    
    // Add member
    await pool.query(
      `INSERT INTO team_members (team_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [teamId, userId]
    );
    
    return { success: true };
  }

  /**
   * Remove user from team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   */
  async removeMember(teamId, userId) {
    await pool.query(
      `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );
    
    return { success: true };
  }

  /**
   * Get team members
   * @param {string} teamId - Team ID
   * @returns {Promise<array>} - Array of users
   */
  async getMembers(teamId) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.organization_id, u.created_at, tm.joined_at
       FROM users u
       JOIN team_members tm ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at DESC`,
      [teamId]
    );
    
    return { users: result.rows };
  }

  /**
   * Get user's teams
   * @param {string} userId - User ID
   * @returns {Promise<array>} - Array of teams
   */
  async getUserTeams(userId) {
    const result = await pool.query(
      `SELECT t.*, tm.joined_at
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1
       ORDER BY t.name`,
      [userId]
    );
    
    return { teams: result.rows };
  }

  /**
   * Assign role to team (all members get role)
   * @param {string} teamId - Team ID
   * @param {string} roleId - Role ID
   */
  async assignTeamRole(teamId, roleId) {
    // Get all team members
    const membersResult = await pool.query(
      `SELECT user_id FROM team_members WHERE team_id = $1`,
      [teamId]
    );
    
    // Assign role to each member
    for (const member of membersResult.rows) {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [member.user_id, roleId]
      );
    }
    
    return { success: true };
  }

  /**
   * Remove role from team
   * @param {string} teamId - Team ID
   * @param {string} roleId - Role ID
   */
  async removeTeamRole(teamId, roleId) {
    // Get all team members
    const membersResult = await pool.query(
      `SELECT user_id FROM team_members WHERE team_id = $1`,
      [teamId]
    );
    
    // Remove role from each member
    for (const member of membersResult.rows) {
      await pool.query(
        `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
        [member.user_id, roleId]
      );
    }
    
    return { success: true };
  }
}

module.exports = new TeamService();
