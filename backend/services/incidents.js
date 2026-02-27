const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/incidents.log');

// Ensure log directory
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function logActivity(level, message) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message
    };
    try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
        console.log(`[${level.toUpperCase()}] ${message}`); 
    } catch (e) {
        console.error('Failed to write to incident log:', e.message);
    }
}

module.exports = { logActivity };
