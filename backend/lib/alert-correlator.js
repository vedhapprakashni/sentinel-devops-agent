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

                // Only consult the dependency graph — alerts.length > 1 is already
                // guaranteed by the .filter() above so it must not be used here.
                const deps = dependencyGraph.getDependencies(rootCauseId);
                const isSharedDependency = deps.length > 0 ? 1 : 0;

                // Build correlation signals explaining why these alerts are grouped
                const correlationSignals = ['same_compose_project'];
                if (isSharedDependency) correlationSignals.push('shared_dependency');
                if (alerts.length > 2) correlationSignals.push('cascade_pattern');

                // Root-cause probability: higher when the dependency graph confirms
                // a shared dependency, lower for project-only correlation
                const rootCauseProbability = isSharedDependency
                    ? Math.min(0.95, 0.7 + (deps.length * 0.05))
                    : Math.min(0.8, 0.5 + (alerts.length * 0.05));

                // Deterministic groupId from sorted container IDs for stable
                // React keys and client-side deduplication
                const stableKey = alerts
                    .map(a => a.containerId)
                    .sort()
                    .join('_');

                return {
                    groupId: `grp_${projectKey}_${stableKey}`,
                    rootCauseContainerId: rootCauseId,
                    rootCauseProbability,
                    affectedContainers: alerts.map(a => a.containerId),
                    blastRadius: alerts.length + (2 * isSharedDependency),
                    correlationSignals,
                    suppressedAlerts: alerts.length - 1,
                };
            });
    }
}

module.exports = new AlertCorrelator();
