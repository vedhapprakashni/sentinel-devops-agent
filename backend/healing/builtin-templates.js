const BUILTIN_CONDITIONS = [
    {
        type: 'high_cpu',
        label: 'High CPU Usage',
        description: 'Trigger when CPU usage exceeds X% for Y seconds',
        defaultParameters: { threshold: 90, window: 30 }
    },
    {
        type: 'high_memory',
        label: 'Memory Leak',
        description: 'Trigger when memory usage exceeds X% for Y minutes',
        defaultParameters: { threshold: 80, window: 300 }
    },
    {
        type: 'crash_loop',
        label: 'Crash Loop',
        description: 'Trigger when container restarts > N times in M minutes',
        defaultParameters: { threshold: 3, window: 300 }
    },
    {
        type: 'health_check_fail',
        label: 'Health Check Failure',
        description: 'Trigger when health check fails N consecutive times',
        defaultParameters: { threshold: 3 }
    },
    {
        type: 'error_rate_spike',
        label: 'Error Rate Spike',
        description: 'Trigger when error rate exceeds X% in Y minutes',
        defaultParameters: { threshold: 5, window: 60 }
    }
];

const BUILTIN_ACTIONS = [
    {
        type: 'restart_container',
        label: 'Restart Container',
        description: 'Cleanly restart the affected docker container',
        parameters: {}
    },
    {
        type: 'scale_replicas',
        label: 'Scale Replicas',
        description: 'Scale service replicas up or down',
        parameters: { replicas: 1, mode: 'absolute' }
    },
    {
        type: 'run_command',
        label: 'Run Command',
        description: 'Execute a custom diagnostic command',
        parameters: { command: 'ps aux' }
    },
    {
        type: 'notify_slack',
        label: 'Notify Slack',
        description: 'Send an alert to a Slack channel',
        parameters: { channel: '#incidents', message: 'Runbook triggered' }
    },
    {
        type: 'create_jira',
        label: 'Create Jira Ticket',
        description: 'Open a new issue in Jira project',
        parameters: { project: 'SENTINEL', priority: 'High' }
    }
];

module.exports = { BUILTIN_CONDITIONS, BUILTIN_ACTIONS };
