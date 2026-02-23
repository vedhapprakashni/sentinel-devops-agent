const pool = require('../db/config');

class AuditService {
  /**
   * Log an audit event
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @param {object} details - Additional details
   * @param {string} ipAddress - IP address
   * @returns {Promise<string>} - Log ID
   */
  async logEvent(userId, action, resourceType, resourceId, details = {}, ipAddress = null) {
    const result = await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, action, resourceType, resourceId, JSON.stringify(details), ipAddress]
    );
    
    return { logId: result.rows[0].id };
  }

  /**
   * Query audit logs with filters
   * @param {object} filters - Filter options
   * @returns {Promise<object>} - Logs and total count
   */
  async queryLogs(filters = {}) {
    const {
      userId,
      action,
      resourceType,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = filters;
    
    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];
    let paramCount = 1;
    
    if (userId) {
      query += ` AND user_id = $${paramCount++}`;
      params.push(userId);
    }
    
    if (action) {
      query += ` AND action = $${paramCount++}`;
      params.push(action);
    }
    
    if (resourceType) {
      query += ` AND resource_type = $${paramCount++}`;
      params.push(resourceType);
    }
    
    if (startDate) {
      query += ` AND created_at >= $${paramCount++}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND created_at <= $${paramCount++}`;
      params.push(endDate);
    }
    
    // Get total count
    const countResult = await pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    return {
      logs: result.rows,
      total,
      limit,
      offset
    };
  }

  /**
   * Get logs for specific user
   * @param {string} userId - User ID
   * @param {number} limit - Limit
   * @param {number} offset - Offset
   * @returns {Promise<object>} - Logs and total count
   */
  async getUserLogs(userId, limit = 50, offset = 0) {
    return this.queryLogs({ userId, limit, offset });
  }

  /**
   * Get logs for specific resource
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @param {number} limit - Limit
   * @param {number} offset - Offset
   * @returns {Promise<object>} - Logs and total count
   */
  async getResourceLogs(resourceType, resourceId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM audit_logs
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [resourceType, resourceId, limit, offset]
    );
    
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs
       WHERE resource_type = $1 AND resource_id = $2`,
      [resourceType, resourceId]
    );
    
    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }

  /**
   * Clean up old logs (retention policy)
   * @param {number} retentionDays - Number of days to retain logs
   * @returns {Promise<number>} - Number of deleted logs
   */
  async cleanupOldLogs(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await pool.query(
      `DELETE FROM audit_logs WHERE created_at < $1`,
      [cutoffDate]
    );
    
    return { deletedCount: result.rowCount };
  }
}

module.exports = new AuditService();
