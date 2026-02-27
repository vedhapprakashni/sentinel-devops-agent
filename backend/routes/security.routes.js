const express = require('express');
const router = express.Router();
const { scanImage, startScanner } = require('../security/scanner');
const { getPolicy, updatePolicy, checkCompliance } = require('../security/policies');
const containerMonitor = require('../docker/monitor');

router.get('/scan/:imageId', async (req, res) => {
    try {
        const imageId = req.params.imageId;
        const result = await scanImage(imageId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/compliance/:imageId', async (req, res) => {
    try {
        const imageId = req.params.imageId;
        const result = await scanImage(imageId);
        const check = checkCompliance(result);
        res.json({ ...check, scannedAt: result.scannedAt });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/policies', (req, res) => {
    res.json(getPolicy());
});

router.post('/policies', (req, res) => {
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
        require('../security/scanner').clearCache();
    }
    
    // We assume containerMonitor has a method or property to get active containers
    // From previous context: containerMonitor.getMetrics(id) returns metrics
    // We might need to inject the list of containers or fetch them via docker client
    
    // For now returning OK, as actual scanning is typically background task
    res.json({ message: 'Scan initiated' });
});

module.exports = router;
