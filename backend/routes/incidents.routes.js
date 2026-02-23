const express = require('express');
const router = express.Router();
const monitor = require('../docker/monitor');
const { requireAuth } = require('../auth/middleware');

// GET /api/incidents/correlated
router.get('/correlated', requireAuth, (req, res) => {
    try {
        const groups = monitor.getCorrelatedGroups() || [];
        res.json({ success: true, groups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Since the platform originally fetched incidents via `/api/insights`,
// we can also augment or leave it separate. The frontend will hit this new endpoint.

module.exports = router;
