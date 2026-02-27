// Load environment variables
require('dotenv').config();

const { setupWebSocket } = require('./websocket');
const express = require('express');
const { ERRORS } = require('./lib/errors');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { listContainers, getContainerHealth } = require('./docker/client');
const monitor = require('./docker/monitor');
const healer = require('./docker/healer');

// RBAC Routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const rolesRoutes = require('./routes/roles.routes');
const { apiLimiter } = require('./middleware/rateLimiter');

// SLO Routes
const sloRoutes = require('./routes/slo.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Rate limiters (ADD HERE)
app.use('/api', apiLimiter);

// RBAC Routes
app.use('/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);

// SLO Routes
app.use('/api/slo', sloRoutes);

// Runbook Routes (GET public; POST/PUT/DELETE protected inside router)
app.use('/api/runbooks', runbooksRoutes);

// --- IN-MEMORY DATABASE ---
let systemStatus = {
  services: {
    auth: { status: 'unknown', code: 0, lastUpdated: null },
    payment: { status: 'unknown', code: 0, lastUpdated: null },
    notification: { status: 'unknown', code: 0, lastUpdated: null }
  },
  aiAnalysis: "Waiting for AI report...",
  lastUpdated: new Date()
};

let activityLog = [];
let aiLogs = [];
let nextLogId = 1;

function logActivity(type, message) {
  const entry = {
    id: nextLogId++,
    timestamp: new Date().toISOString(),
    type,
    message
  };
  activityLog.unshift(entry);
  if (activityLog.length > 100) activityLog.pop(); // Keep last 100
  console.log(`[LOG] ${type}: ${message}`);
}

// WebSocket Broadcaster
let wsBroadcaster = { broadcast: () => { } };

// Service configuration
const services = [
  { name: 'auth', url: 'http://localhost:3001/health' },
  { name: 'payment', url: 'http://localhost:3002/health' },
  { name: 'notification', url: 'http://localhost:3003/health' }
];

// Smart Restart Tracking
const restartTracker = new Map(); // containerId -> { attempts: number, lastAttempt: number }
const MAX_RESTARTS = 3;
const GRACE_PERIOD_MS = 60 * 1000; // 1 minute

// Continuous health checking
let isChecking = false;

async function checkServiceHealth() {
  if (isChecking) return;
  isChecking = true;

  try {
    console.log('Checking service health...');
    let hasChanges = false;

    for (const service of services) {
      let newStatus, newCode;
      try {
        const response = await axios.get(service.url, { timeout: 30000 });
        console.log(`${service.name}: ${response.status} - ${response.data.status}`);
        newStatus = 'healthy';
        newCode = response.status;
      } catch (error) {
        const code = error.response?.status || 503;
        console.log(`${service.name}: ERROR - ${error.code || error.message}`);
        newStatus = code >= 500 ? 'critical' : 'degraded';
        newCode = code;
      }

      if (
        systemStatus.services[service.name].status !== newStatus ||
        systemStatus.services[service.name].code !== newCode
      ) {
        const prevStatus = systemStatus.services[service.name].status;

        // Log Status Changes
        if (newStatus === 'healthy' && prevStatus !== 'healthy' && prevStatus !== 'unknown') {
          logActivity('success', `Service ${service.name} recovered to HEALTHY`);
        } else if (newStatus !== 'healthy' && prevStatus !== newStatus) {
          const severity = newStatus === 'critical' ? 'alert' : 'warn';
          logActivity(severity, `Service ${service.name} is ${newStatus.toUpperCase()} (Code: ${newCode})`);
        }

        systemStatus.services[service.name] = {
          status: newStatus,
          code: newCode,
          lastUpdated: new Date()
        };
        hasChanges = true;

        // Broadcast individual service update
        wsBroadcaster.broadcast('SERVICE_UPDATE', {
          name: service.name,
          ...systemStatus.services[service.name]
        });
      }
    }

    if (hasChanges) {
      systemStatus.lastUpdated = new Date();
      // Broadcast full metrics update
      wsBroadcaster.broadcast('METRICS', systemStatus);
    }
  } finally {
    isChecking = false;
  }
}

setInterval(checkServiceHealth, 5000);
checkServiceHealth();

// --- ENDPOINTS FOR FRONTEND ---

app.get('/api/status', (req, res) => {
  res.json(systemStatus);
});

app.get('/api/activity', (req, res) => {
  res.json({ activity: activityLog.slice(0, 50) });
});

app.get('/api/insights', (req, res) => {
  res.json({ insights: aiLogs.slice(0, 20) });
});

app.post('/api/kestra-webhook', (req, res) => {
  const { aiReport, metrics } = req.body;
  if (aiReport) {
    systemStatus.aiAnalysis = aiReport;
    // Create an incident/insight object
    const insight = {
      id: Date.now(),
      timestamp: new Date(),
      analysis: aiReport,
      summary: aiReport
    };
    aiLogs.unshift(insight);
    if (aiLogs.length > 50) aiLogs.pop();

    logActivity('info', 'Received new AI Analysis report');

    // Broadcast new incident/insight
    wsBroadcaster.broadcast('INCIDENT_NEW', insight);
  }
  systemStatus.lastUpdated = new Date();

  if (metrics) {
    Object.keys(metrics).forEach(serviceName => {
      if (systemStatus.services[serviceName]) {
        systemStatus.services[serviceName].code = metrics[serviceName].code || 0;
        const code = metrics[serviceName].code;
        const newStatus = code >= 200 && code < 300 ? 'healthy' :
          code >= 500 ? 'critical' : 'degraded';

        if (systemStatus.services[serviceName].status !== newStatus) {
          const severity = newStatus === 'healthy' ? 'success' : (newStatus === 'critical' ? 'alert' : 'warn');
          logActivity(severity, `Metric update: ${serviceName} is now ${newStatus}`);
        }

        systemStatus.services[serviceName].status = newStatus;
        systemStatus.services[serviceName].lastUpdated = new Date();
      }
    });
    // Broadcast metrics update from webhook
    wsBroadcaster.broadcast('METRICS', systemStatus);
  }
  res.json({ success: true });
});

app.post('/api/action/:service/:type', async (req, res) => {
  const { service, type } = req.params;
  const serviceMap = { 'auth': 3001, 'payment': 3002, 'notification': 3003 };
  const port = serviceMap[service];

  logActivity('info', `Triggering action '${type}' on service '${service}'`);

  if (!port) {
    logActivity('warn', `Failed action '${type}': Invalid service '${service}'`);
    return res.status(400).json(ERRORS.SERVICE_NOT_FOUND(service).toJSON());
  }

  try {
    let mode = 'healthy';
    if (type === 'crash' || type === 'down') mode = 'down';
    if (type === 'degraded') mode = 'degraded';
    if (type === 'slow') mode = 'slow';

    await axios.post(`http://localhost:${port}/simulate/${mode}`, {}, { timeout: 5000 });
    // Force a health check to update status immediately
    await checkServiceHealth();

    logActivity('success', `Successfully executed '${type}' on ${service}`);
    res.json({ success: true, message: `${type} executed on ${service}` });
  } catch (error) {
    logActivity('error', `Action '${type}' on ${service} failed.`);
    res.status(500).json(ERRORS.ACTION_FAILED().toJSON());
  }
});

// --- DOCKER ENDPOINTS ---

// Middleware for ID/Service validation (mock auth for docker endpoints)
const requireDockerAuth = (req, res, next) => {
  // In a real app, check 'Authorization' header
  // For now, assume authenticated if internal or trusted
  next();
};

const validateId = (req, res, next) => {
  if (!req.params.id || typeof req.params.id !== 'string' || req.params.id.length < 1) {
    return res.status(400).json(ERRORS.INVALID_ID().toJSON());
  }
  next();
};

const validateScaleParams = (req, res, next) => {
  const replicasRaw = req.params.replicas;
  const replicas = Number(replicasRaw);
  if (!req.params.service || !/^\d+$/.test(replicasRaw) || !Number.isInteger(replicas) || replicas < 0 || replicas > 100) {
    return res.status(400).json(ERRORS.INVALID_SCALE_PARAMS().toJSON());
  }
  next();
};

app.get('/api/docker/containers', async (req, res) => {
  try {
    const containers = await listContainers();
    // Use Promise.allSettled to handle monitoring setup concurrently without crashing
    await Promise.allSettled(containers.map(c => monitor.startMonitoring(c.id)));

    // Enrich with smart restart meta
    const enrichedContainers = containers.map(c => {
      const tracker = restartTracker.get(c.id) || { attempts: 0, lastAttempt: 0 };
      return {
        ...c,
        metrics: monitor.getMetrics(c.id), // Include current metrics snapshot
        restartCount: tracker.attempts,
        lastRestart: tracker.lastAttempt
      };
    });

    res.json({ containers: enrichedContainers });
  } catch (error) {
    console.error(error);
    res.status(500).json(ERRORS.DOCKER_CONNECTION().toJSON());
  }
});

app.get('/api/docker/health/:id', validateId, async (req, res) => {
  try {
    const health = await getContainerHealth(req.params.id);
    res.json(health);
  } catch (error) {
    console.error(error);
    res.status(500).json(ERRORS.DOCKER_CONNECTION().toJSON());
  }
});

app.get('/api/docker/metrics/:id', validateId, (req, res) => {
  const metrics = monitor.getMetrics(req.params.id);
  if (!metrics) {
    return res.status(404).json(ERRORS.NO_DATA().toJSON());
  }
  res.json(metrics);
});

app.post('/api/docker/try-restart/:id', requireDockerAuth, validateId, async (req, res) => {
  const id = req.params.id;
  const now = Date.now();
  let tracker = restartTracker.get(id) || { attempts: 0, lastAttempt: 0 };

  // Reset attempts if outside grace period
  if (now - tracker.lastAttempt > GRACE_PERIOD_MS) {
    tracker.attempts = 0;
  }

  if (tracker.attempts >= MAX_RESTARTS) {
    return res.status(429).json(ERRORS.MAX_RESTARTS_EXCEEDED().toJSON());
  }

  tracker.attempts++;
  tracker.lastAttempt = now;
  restartTracker.set(id, tracker);

  try {
    const result = await healer.restartContainer(id);
    res.json({ allowed: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json(ERRORS.ACTION_FAILED().toJSON());
  }
});

app.post('/api/docker/restart/:id', requireDockerAuth, validateId, async (req, res) => {
  // Manual override bypasses smart checks, or update tracker manually
  const id = req.params.id;
  // Update tracker so manual restarts count towards limits or reset headers? 
  // For manual, we usually want to force it. We won't incr limits but update 'lastAttempt' timestamp
  const now = Date.now();
  let tracker = restartTracker.get(id) || { attempts: 0, lastAttempt: 0 };
  tracker.lastAttempt = now;
  restartTracker.set(id, tracker);

  try {
    const result = await healer.restartContainer(id);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json(ERRORS.ACTION_FAILED().toJSON());
  }
});

app.post('/api/docker/recreate/:id', requireDockerAuth, validateId, async (req, res) => {
  try {
    const result = await healer.recreateContainer(req.params.id);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json(ERRORS.ACTION_FAILED().toJSON());
  }
});

app.post('/api/docker/scale/:service/:replicas', requireDockerAuth, validateScaleParams, async (req, res) => {
  try {
    const result = await healer.scaleService(req.params.service, req.params.replicas);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json(ERRORS.ACTION_FAILED().toJSON());
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sentinel Backend running on http://0.0.0.0:${PORT}`);
});

// Setup WebSocket
wsBroadcaster = setupWebSocket(server);
