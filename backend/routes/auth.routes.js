const express = require('express');
const router = express.Router();
const AuthService = require('../auth/AuthService');
const AuditService = require('../auth/AuditService');
const { requireAuth, rateLimit } = require('../auth/middleware');

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', rateLimit(5, 60 * 1000), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    };
    
    const result = await AuthService.login(email, password, deviceInfo);
    
    // Log successful login
    await AuditService.logEvent(
      result.user.id,
      'LOGIN_SUCCESS',
      'user',
      result.user.id,
      { email },
      deviceInfo.ip
    );
    
    res.json(result);
  } catch (error) {
    // Log failed login
    if (req.body.email) {
      await AuditService.logEvent(
        null,
        'LOGIN_FAILED',
        'user',
        null,
        { email: req.body.email, reason: error.message },
        req.ip || req.connection.remoteAddress
      );
    }
    
    res.status(401).json({ error: error.message });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    const result = await AuthService.refreshToken(refreshToken);
    
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * POST /auth/logout
 * Logout user (revoke all refresh tokens)
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await AuthService.logout(req.user.userId);
    
    // Log logout
    await AuditService.logEvent(
      req.user.userId,
      'LOGOUT',
      'user',
      req.user.userId,
      {},
      req.ip || req.connection.remoteAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /auth/logout-session
 * Logout specific session (revoke specific refresh token)
 */
router.post('/logout-session', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Verify session ownership before revoking
    const pool = require('../db/config');
    const sessionResult = await pool.query(
      `SELECT user_id FROM refresh_tokens WHERE id = $1`,
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (sessionResult.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Cannot revoke another user\'s session' });
    }
    
    await AuthService.logoutSession(sessionId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /auth/password-reset-request
 * Request password reset
 */
router.post('/password-reset-request', rateLimit(3, 60 * 60 * 1000), async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const result = await AuthService.requestPasswordReset(email);
    
    // In production, send email with reset token
    // For now, return the token (in production, this would be sent via email)
    res.json({ 
      success: true,
      message: 'If the email exists, a password reset link has been sent',
      // Remove this in production:
      resetToken: result.resetToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /auth/password-reset
 * Reset password using reset token
 */
router.post('/password-reset', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    await AuthService.resetPassword(resetToken, newPassword);
    
    // Log password reset
    await AuditService.logEvent(
      null,
      'PASSWORD_RESET',
      'user',
      null,
      {},
      req.ip || req.connection.remoteAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /auth/sessions
 * Get user's active sessions
 */
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const pool = require('../db/config');
    
    const result = await pool.query(
      `SELECT id, device_info, created_at, expires_at
       FROM refresh_tokens
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user.userId]
    );
    
    res.json({ sessions: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
