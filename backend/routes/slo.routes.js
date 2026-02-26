/**
 * SLO Routes
 * 
 * RESTful API endpoints for SLO/SLA tracking and error budget management.
 */

const express = require('express');
const router = express.Router();
const sloModel = require('../models/slo-definition');
const tracker = require('../slo/tracker');
const { calculateErrorBudget, generateBurndownData, MINUTES_PER_WINDOW } = require('../slo/calculator');

/**
 * GET /api/slo
 * List all SLO definitions with computed error budgets.
 */
router.get('/', (req, res) => {
    try {
        const slos = sloModel.getAll();
        const results = slos.map(slo => {
            const incidents = tracker.getIncidents(slo.serviceId);
            const budget = calculateErrorBudget(slo, incidents);
            return { ...slo, budget };
        });

        // Summary stats
        const totalSLOs = results.length;
        const healthyCount = results.filter(r => r.budget.status === 'healthy').length;
        const warningCount = results.filter(r => r.budget.status === 'warning').length;
        const criticalCount = results.filter(r => r.budget.status === 'critical' || r.budget.status === 'exhausted').length;

        res.json({
            slos: results,
            summary: {
                total: totalSLOs,
                healthy: healthyCount,
                warning: warningCount,
                critical: criticalCount,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/slo/:id
 * Get a single SLO definition with full budget breakdown.
 */
router.get('/:id', (req, res) => {
    try {
        const slo = sloModel.getById(req.params.id);
        if (!slo) {
            return res.status(404).json({ error: 'SLO definition not found' });
        }

        const incidents = tracker.getIncidents(slo.serviceId);
        const budget = calculateErrorBudget(slo, incidents);
        const burndown = generateBurndownData(slo, incidents);

        res.json({ ...slo, budget, burndown, incidents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/slo
 * Create a new SLO definition.
 */
router.post('/', (req, res) => {
    try {
        const slo = sloModel.create(req.body);
        res.status(201).json(slo);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/slo/:id
 * Update an existing SLO definition.
 */
router.put('/:id', (req, res) => {
    try {
        const slo = sloModel.update(req.params.id, req.body);
        if (!slo) {
            return res.status(404).json({ error: 'SLO definition not found' });
        }
        res.json(slo);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * DELETE /api/slo/:id
 * Delete an SLO definition.
 */
router.delete('/:id', (req, res) => {
    try {
        const deleted = sloModel.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'SLO definition not found' });
        }
        res.json({ success: true, message: 'SLO definition deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/slo/:id/downtime
 * Record a downtime event for the service associated with this SLO.
 */
router.post('/:id/downtime', (req, res) => {
    try {
        const slo = sloModel.getById(req.params.id);
        if (!slo) {
            return res.status(404).json({ error: 'SLO definition not found' });
        }

        const { downtimeMinutes, description } = req.body;
        if (!downtimeMinutes || typeof downtimeMinutes !== 'number' || downtimeMinutes <= 0) {
            return res.status(400).json({ error: 'downtimeMinutes must be a positive number' });
        }

        const event = tracker.recordDowntime(slo.serviceId, downtimeMinutes, description || '');

        // Recalculate budget after recording
        const incidents = tracker.getIncidents(slo.serviceId);
        const budget = calculateErrorBudget(slo, incidents);

        res.status(201).json({ event, budget });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/slo/:id/burndown
 * Get burndown chart data for an SLO.
 */
router.get('/:id/burndown', (req, res) => {
    try {
        const slo = sloModel.getById(req.params.id);
        if (!slo) {
            return res.status(404).json({ error: 'SLO definition not found' });
        }

        const incidents = tracker.getIncidents(slo.serviceId);
        const points = parseInt(req.query.points) || 30;
        const burndown = generateBurndownData(slo, incidents, Math.min(points, 100));

        res.json({ burndown });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
