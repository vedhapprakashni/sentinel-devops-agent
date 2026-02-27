const express = require('express');
const router = express.Router();
const { scanImage, startScanner, clearCache } = require('../security/scanner');
const { getPolicy, updatePolicy, checkCompliance } = require('../security/policies');
const containerMonitor = require('../docker/monitor');

// Use query param ?imageId=... since image names can contain /
router.get('/scan', async (req, res) => {
    try {
        const imageId = req.query.imageId;
        if (!imageId) return res.status(400).json({ error: 'imageId query parameter required' });
        const result = await scanImage(imageId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/compliance', async (req, res) => {
    try {
        const imageId = req.query.imageId;
        if (!imageId) return res.status(400).json({ error: 'imageId query parameter required' });
        const result = await scanImage(imageId);
        const check = checkCompliance(result);
        res.json({ ...check, scannedAt: result.scannedAt });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const { requirePermissions } = require('../auth/middleware');

router.get('/policies', (req, res) => {
    res.json(getPolicy());
});

router.post('/policies', requirePermissions('security:write'), (req, res) => {
    try {
        const newPolicy = req.body;
        updatePolicy(newPolicy);
        res.json(getPolicy());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Endpoint to trigger scan on all active containers and clear cache if forced
router.post('/scan-all', async (req, res) => {
    const force = req.query.force === 'true';
    if (force) {
        clearCache();
    }
    
    return res.status(501).json({
        error: 'scan-all not implemented: no container enumeration/dispatch is currently performed'
    });
});

module.exports = router;
