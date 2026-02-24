const express = require('express');
const router = express.Router();
const pool = require('../db/config');
const { compileToKestraWorkflow } = require('../healing/runbook-compiler');

// GET /api/runbooks - List all runbooks
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM runbooks ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/runbooks/:id - Get specific runbook
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM runbooks WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Runbook not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/runbooks - Create new runbook
router.post('/', async (req, res) => {
    const { name, description, triggers, actions } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            'INSERT INTO runbooks (name, description, triggers, actions) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, description, JSON.stringify(triggers || []), JSON.stringify(actions || [])]
        );
        const newRunbook = result.rows[0];

        // Store initial version
        await client.query(
            'INSERT INTO runbook_versions (runbook_id, version, triggers, actions) VALUES ($1, $2, $3, $4)',
            [newRunbook.id, 1, newRunbook.triggers, newRunbook.actions]
        );

        // Compile to Kestra YAML
        const kestraYaml = compileToKestraWorkflow(newRunbook);
        // In a real app, you'd deploy this to Kestra here

        await client.query('COMMIT');
        res.status(201).json({ ...newRunbook, kestraYaml });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// PUT /api/runbooks/:id - Update runbook
router.put('/:id', async (req, res) => {
    const { name, description, triggers, actions, enabled } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current version
        const current = await client.query('SELECT version FROM runbooks WHERE id = $1', [req.params.id]);
        if (current.rows.length === 0) return res.status(404).json({ error: 'Runbook not found' });

        const newVersion = current.rows[0].version + 1;

        const result = await client.query(
            'UPDATE runbooks SET name = $1, description = $2, triggers = $3, actions = $4, enabled = $5, version = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
            [name, description, JSON.stringify(triggers), JSON.stringify(actions), enabled, newVersion, req.params.id]
        );
        const updatedRunbook = result.rows[0];

        // Store new version
        await client.query(
            'INSERT INTO runbook_versions (runbook_id, version, triggers, actions) VALUES ($1, $2, $3, $4)',
            [updatedRunbook.id, newVersion, updatedRunbook.triggers, updatedRunbook.actions]
        );

        // Re-compile Kestra workflow
        const kestraYaml = compileToKestraWorkflow(updatedRunbook);

        await client.query('COMMIT');
        res.json({ ...updatedRunbook, kestraYaml });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE /api/runbooks/:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM runbooks WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
