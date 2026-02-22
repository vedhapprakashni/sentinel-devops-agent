const CORRELATION_WINDOW_MS = 60 * 1000;
const dependencyGraph = require('./dependency-graph');

class AlertCorrelator {
    constructor() { this.recentAlerts = []; }

    add(alert) {
        const now = Date.now();
        this.recentAlerts = this.recentAlerts.filter(a => now - a.ts < CORRELATION_WINDOW_MS);
        this.recentAlerts.push({ ...alert, ts: now });
        return this.correlate();
    }

    correlate() {
        // Group by Docker Compose project label
        const groups = new Map();
        for (const alert of this.recentAlerts) {
            const key = alert.labels?.['com.docker.compose.project'] || alert.containerId;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(alert);
        }

        return [...groups.entries()]
            .filter(([, alerts]) => alerts.length > 1)
            .map(([projectKey, alerts]) => {
                const sorted = alerts.sort((a, b) => a.ts - b.ts);
                const rootCauseId = sorted[0].containerId;
                // Check if rootCause has any dependents or is just shared by project
                const deps = dependencyGraph.getDependencies(rootCauseId);
                const isSharedDependency = deps.length > 0 || alerts.length > 1 ? 1 : 0;

                return {
                    groupId: `grp_${projectKey}_${Date.now()}`,
                    rootCauseContainerId: rootCauseId,
                    affectedContainers: alerts.map(a => a.containerId),
                    blastRadius: alerts.length + (2 * isSharedDependency),
                    suppressedAlerts: alerts.length - 1,
                }
            });
    }
}

module.exports = new AlertCorrelator();
