const pool = require('../db/config');

class RateLimiterService {
  /**
   * Check if request is allowed
   * @param {string} key - IP address or user ID
   * @param {number} maxRequests - Maximum requests allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<object>} - Allowed status, remaining requests, reset time
   */
  async checkLimit(key, maxRequests, windowMs) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    // Get or create rate limit record
    const result = await pool.query(
      `SELECT * FROM rate_limits WHERE key = $1`,
      [key]
    );
    
    if (result.rows.length === 0) {
      // First request, create record
      await pool.query(
        `INSERT INTO rate_limits (key, requests, window_start)
         VALUES ($1, 1, $2)`,
        [key, now]
      );
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now.getTime() + windowMs)
      };
    }
    
    const record = result.rows[0];
    const recordWindowStart = new Date(record.window_start);
    
    // Check if window has expired
    if (recordWindowStart < windowStart) {
      // Reset window
      await pool.query(
        `UPDATE rate_limits 
         SET requests = 1, window_start = $1
         WHERE key = $2`,
        [now, key]
      );
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now.getTime() + windowMs)
      };
    }
    
    // Check if limit exceeded
    if (record.requests >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(recordWindowStart.getTime() + windowMs)
      };
    }
    
    // Increment request count
    await pool.query(
      `UPDATE rate_limits SET requests = requests + 1 WHERE key = $1`,
      [key]
    );
    
    return {
      allowed: true,
      remaining: maxRequests - record.requests - 1,
      resetAt: new Date(recordWindowStart.getTime() + windowMs)
    };
  }

  /**
   * Record a request
   * @param {string} key - IP address or user ID
   * @param {number} windowMs - Time window in milliseconds
   */
  async recordRequest(key, windowMs) {
    const now = new Date();
    
    await pool.query(
      `INSERT INTO rate_limits (key, requests, window_start)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE
       SET requests = rate_limits.requests + 1`,
      [key, now]
    );
  }

  /**
   * Reset limits for key
   * @param {string} key - IP address or user ID
   */
  async resetLimits(key) {
    await pool.query(
      `DELETE FROM rate_limits WHERE key = $1`,
      [key]
    );
  }

  /**
   * Get current limit status
   * @param {string} key - IP address or user ID
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<object>} - Current status
   */
  async getLimitStatus(key, windowMs) {
    const result = await pool.query(
      `SELECT * FROM rate_limits WHERE key = $1`,
      [key]
    );
    
    if (result.rows.length === 0) {
      return {
        requests: 0,
        remaining: Infinity,
        resetAt: null
      };
    }
    
    const record = result.rows[0];
    const resetAt = new Date(new Date(record.window_start).getTime() + windowMs);
    
    return {
      requests: record.requests,
      resetAt
    };
  }

  /**
   * Clean up expired rate limit records
   */
  async cleanup() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    await pool.query(
      `DELETE FROM rate_limits WHERE window_start < $1`,
      [cutoff]
    );
  }
}

module.exports = new RateLimiterService();
