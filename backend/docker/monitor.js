const { docker } = require('./client');
const flapDetector = require('../lib/flap-detector');
const alertCorrelator = require('../lib/alert-correlator');
const dependencyGraph = require('../lib/dependency-graph');

class ContainerMonitor {
    constructor() {
        this.metrics = new Map();
        this.watchers = new Map();
        this.healthTimers = new Map();
        this.containerLabels = new Map();
        this.containerInfoCache = new Map(); // Full inspect data for dependency graph
        this.lastHealthState = new Map();
    }

    async startMonitoring(containerId) {
        if (this.watchers.has(containerId)) return;

        try {
            const container = docker.getContainer(containerId);
            const info = await container.inspect();
            this.containerLabels.set(containerId, info.Config.Labels);
            this.containerInfoCache.set(containerId, info);

            // Rebuild dependency graph from all known containers
            dependencyGraph.populateFromContainers([...this.containerInfoCache.values()]);

            // Obtain stats stream BEFORE starting the health timer,
            // so a stats() failure doesn't leave an orphaned interval.
            const stream = await container.stats({ stream: true });

            // Only start polling health after stats stream is established
            const healthTimer = setInterval(() => this.checkContainerHealth(containerId), 5000);
            this.healthTimers.set(containerId, healthTimer);

            stream.on('data', (chunk) => {
                try {
                    const stats = JSON.parse(chunk.toString());
                    this.metrics.set(containerId, this.parseStats(stats));
                } catch (e) {
                    // Ignore parse errors from partial chunks
                }
            });

            stream.on('error', (err) => {
                console.error(`Stream error for ${containerId}:`, err);
                this.stopMonitoring(containerId);
            });

            stream.on('end', () => {
                this.stopMonitoring(containerId);
            });

            this.watchers.set(containerId, stream);
        } catch (error) {
            console.error(`Failed to start monitoring ${containerId}:`, error);
            // Clean up any partially-set state (labels, cache) on failure
            this.containerLabels.delete(containerId);
            this.containerInfoCache.delete(containerId);
        }
    }

    stopMonitoring(containerId) {
        if (this.watchers.has(containerId)) {
            const stream = this.watchers.get(containerId);
            if (stream.destroy) stream.destroy();
            this.watchers.delete(containerId);
            this.metrics.delete(containerId);
        }
        if (this.healthTimers.has(containerId)) {
            clearInterval(this.healthTimers.get(containerId));
            this.healthTimers.delete(containerId);
            this.containerLabels.delete(containerId);
            this.lastHealthState.delete(containerId);
        }
        // Clean up flap history to prevent stale timestamps on restart
        flapDetector.clear(containerId);
        // Remove container from dependency graph
        dependencyGraph.clearContainer(containerId);
        this.containerInfoCache.delete(containerId);
    }

    parseStats(stats) {
        // Calculate CPU percentage safely
        let cpuPercent = 0.0;

        // Defensive read of nested properties
        const cpuUsage = stats.cpu_stats?.cpu_usage?.total_usage || 0;
        const preCpuUsage = stats.precpu_stats?.cpu_usage?.total_usage || 0;
        const systemCpuUsage = stats.cpu_stats?.system_cpu_usage || 0;
        const preSystemCpuUsage = stats.precpu_stats?.system_cpu_usage || 0;
        // Default to 1 online cpu if missing to avoid division issues (stats often omit this on some platforms)
        const onlineCpus = stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;

        const cpuDelta = cpuUsage - preCpuUsage;
        const systemDelta = systemCpuUsage - preSystemCpuUsage;

        if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100;
        }

        // Calculate memory percentage safely
        // memory_stats might be missing or empty on some platforms/versions
        const memStats = stats.memory_stats || {};
        const memUsage = memStats.usage || 0;
        const memLimit = memStats.limit || 0;
        let memPercent = 0;

        if (memLimit > 0) {
            memPercent = (memUsage / memLimit) * 100;
        }

        return {
            cpu: cpuPercent.toFixed(2),
            memory: {
                usage: this.formatBytes(memUsage),
                limit: this.formatBytes(memLimit),
                percent: memPercent.toFixed(2)
            },
            network: {
                rx: this.formatBytes(stats.networks?.eth0?.rx_bytes || 0),
                tx: this.formatBytes(stats.networks?.eth0?.tx_bytes || 0)
            },
            timestamp: new Date()
        };
    }

    formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        // Clamp index to valid range
        const safeIndex = Math.min(Math.max(i, 0), sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(2)) + ' ' + sizes[safeIndex];
    }

    getMetrics(containerId) {
        return this.metrics.get(containerId);
    }

    async checkContainerHealth(containerId) {
        try {
            const container = docker.getContainer(containerId);
            const info = await container.inspect();

            // Determine if truly unhealthy (from docker healthcheck or state)
            const isRunning = info.State.Running;
            const healthStatus = info.State.Health ? info.State.Health.Status : (isRunning ? 'healthy' : 'unhealthy');
            const isHealthy = healthStatus === 'healthy' || healthStatus === 'starting';

            const lastState = this.lastHealthState.get(containerId);
            if (lastState !== isHealthy) {
                this.lastHealthState.set(containerId, isHealthy);

                // State changed! Run through flap detector
                const flapResult = flapDetector.record(containerId, isHealthy);

                if (!isHealthy && !flapResult.suppressAlert) {
                    // Generate an alert and pass to correlator
                    const labels = this.containerLabels.get(containerId) || {};
                    const alert = { containerId, labels, type: 'container_failure', isHealthy };
                    alertCorrelator.add(alert);
                }
            }
        } catch (error) {
            if (error.statusCode === 404) {
                // Container is confirmed gone — stop polling
                console.warn(`Container ${containerId} no longer exists, stopping monitoring.`);
                this.stopMonitoring(containerId);
            } else {
                console.error(`Health check failed for ${containerId}:`, error.message);
            }
        }
    }

    getCorrelatedGroups() {
        // Re-derive from correlator on each call. Now that groupId is
        // deterministic, this is safe and keeps data current (respects
        // the 60-second correlation window, auto-expiring recovered groups).
        return alertCorrelator.correlate();
    }
}

module.exports = new ContainerMonitor();
