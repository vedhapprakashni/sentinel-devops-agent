const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- IN-MEMORY DATABASE (Perfect for Hackathons) ---
let systemStatus = {
  services: {
    auth: { status: 'unknown', code: 0, lastUpdated: null },
    payment: { status: 'unknown', code: 0, lastUpdated: null },
    notification: { status: 'unknown', code: 0, lastUpdated: null }
  },
  aiAnalysis: "Waiting for AI report...",
  lastUpdated: new Date()
};

let activityLog = []; // Stores history of events

// --- ENDPOINTS FOR FRONTEND ---

// 1. Get Overall System Status
app.get('/api/status', (req, res) => {
  res.json(systemStatus);
});

// 2. Get Activity History
app.get('/api/activity', (req, res) => {
  res.json(activityLog.slice(0, 50)); // Return last 50 events
});

// --- WEBHOOK FOR KESTRA ---

// 3. Receive Data from Kestra AI
app.post('/api/kestra-webhook', (req, res) => {
  const { aiReport, metrics } = req.body;

  console.log('📦 Received update from Kestra:', aiReport);

  // Update System Status
  systemStatus.aiAnalysis = aiReport;
  systemStatus.lastUpdated = new Date();

  if (metrics) {
    systemStatus.services = metrics;
  }

  // Add to Activity Log if it's NOT healthy or if it's a significant update
  // We'll log everything for now to see activity in the demo
  const isHealthy = aiReport && aiReport.includes("HEALTHY");
  
  if (!isHealthy) {
      activityLog.unshift({
        id: Date.now(),
        message: aiReport,
        type: 'alert',
        timestamp: new Date()
      });
  } else {
    // Optional: Log healthy checks too, but maybe less frequently or just one "All Clear"
    // For demo visual density, might be nice to log healthy check-ins briefly or skip
    // Let's keep it clean: only alerts in the activity log for now
  }

  // Keep log size manageable
  if (activityLog.length > 50) {
      activityLog = activityLog.slice(0, 50);
  }

  res.json({ success: true });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sentinel Backend running on http://0.0.0.0:${PORT}`);
});
