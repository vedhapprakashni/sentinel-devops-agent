const crypto = require('crypto');
const pool = require('../db/config');

class ApiKeyService {
  /**
   * Generate new API key
   * @param {string} name - Key name
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   * @param {array} scopedPermissions - Array of permission names
   * @param {Date} expiresAt - Expiration date (optional)
   * @returns {Promise<object>} - API key (plaintext) and key ID
   */
  async generateApiKey(name, userId, organizationId, scopedPermissions = [], expiresAt = null) {
    // Generate key: sk_<org_id_prefix>_<random_32_chars>
    const orgPrefix = organizationId.substring(0, 8);
    const randomPart = crypto.randomBytes(16).toString('hex');
    const apiKey = `sk_${orgPrefix}_${randomPart}`;
    
    // Hash the key
    const keyHash = this.hashApiKey(apiKey);
    
    // Store in database
    const result = await pool.query(
      `INSERT INTO api_keys (name, key_hash, user_id, organization_id, scoped_permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, user_id, organization_id, scoped_permissions, created_at, expires_at`,
      [name, keyHash, userId, organizationId, scopedPermissions, expiresAt]
    );
    
    return {
      apiKey, // Return plaintext only once
      keyId: result.rows[0].id,
      ...result.rows[0]
    };
  }

  /**
   * Validate API key
   * @param {string} apiKey - API key
   * @returns {Promise<object>} - User ID, org ID, permissions, key ID
   * @throws {Error} - If key is invalid or expired
   */
  async validateApiKey(apiKey) {
    const keyHash = this.hashApiKey(apiKey);
    
    const result = await pool.query(
      `SELECT id, user_id, organization_id, scoped_permissions, expires_at
       FROM api_keys
       WHERE key_hash = $1`,
      [keyHash]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Invalid API key');
    }
    
    const keyData = result.rows[0];
    
    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      throw new Error('API key expired');
    }
    
    // Update last used timestamp
    await this.recordApiKeyUsage(keyData.id);
    
    return {
      userId: keyData.user_id,
      orgId: keyData.organization_id,
      permissions: keyData.scoped_permissions || [],
      keyId: keyData.id
    };
  }

  /**
   * Revoke API key
   * @param {string} keyId - Key ID
   */
  async revokeApiKey(keyId) {
    await pool.query(
      `DELETE FROM api_keys WHERE id = $1`,
      [keyId]
    );
    
    return { success: true };
  }

  /**
   * List user's API keys
   * @param {string} userId - User ID
   * @returns {Promise<array>} - Array of API keys (without hashes)
   */
  async getUserApiKeys(userId) {
    const result = await pool.query(
      `SELECT id, name, user_id, organization_id, scoped_permissions, last_used_at, created_at, expires_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return { apiKeys: result.rows };
  }

  /**
   * Update last used timestamp
   * @param {string} keyId - Key ID
   */
  async recordApiKeyUsage(keyId) {
    await pool.query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [keyId]
    );
  }

  /**
   * Hash API key with SHA-256
   * @param {string} apiKey - API key
   * @returns {string} - Hash
   */
  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
}

module.exports = new ApiKeyService();
