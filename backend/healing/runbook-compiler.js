const YAML = require('js-yaml');

/**
 * Compiles a visual runbook definition into a Kestra workflow YAML
 * @param {Object} runbook - The runbook object from database
 * @returns {string} - Compiled Kestra YAML
 */
function compileToKestraWorkflow(runbook) {
    const workflowId = `sentinel_runbook_${runbook.id.replace(/-/g, '_')}`;

    const workflow = {
        id: workflowId,
        namespace: 'sentinel.healing',
        description: runbook.description || `Auto-generated runbook: ${runbook.name}`,
        tasks: [
            // 1. Condition Check Task
            {
                id: 'evaluate_conditions',
                type: 'io.kestra.plugin.core.exec.Commands',
                commands: runbook.triggers.map(trigger => generateConditionCheck(trigger)),
            },
            // 2. Actions Tasks
            ...runbook.actions.map((action, i) => ({
                id: `action_${i}_${action.type}`,
                type: actionTypeToKestraPlugin(action.type),
                ...generateActionParameters(action),
            })),
        ],
        triggers: [
            {
                id: 'webhook_trigger',
                type: 'io.kestra.plugin.core.trigger.Webhook',
                key: 'trigger_key', // In real app, this should be secure
            },
        ],
    };

    return YAML.dump(workflow);
}

function generateConditionCheck(trigger) {
    switch (trigger.type) {
        case 'high_cpu':
            return `check_cpu --threshold ${trigger.threshold} --window ${trigger.window}`;
        case 'crash_loop':
            return `check_restarts --threshold ${trigger.threshold} --window ${trigger.window}`;
        default:
            return `echo "Checking ${trigger.type}"`;
    }
}

function actionTypeToKestraPlugin(type) {
    const mapping = {
        restart_container: 'io.kestra.plugin.docker.DockerExec',
        scale_replicas: 'io.kestra.plugin.kubernetes.Scale',
        notify_slack: 'io.kestra.plugin.notifications.slack.SlackIncomingWebhook',
        run_command: 'io.kestra.plugin.core.exec.Commands',
    };
    return mapping[type] || 'io.kestra.plugin.core.log.Log';
}

function generateActionParameters(action) {
    switch (action.type) {
        case 'notify_slack':
            return {
                url: '{{ secret("SLACK_WEBHOOK") }}',
                payload: {
                    text: action.parameters?.message || 'Sentinel Runbook Triggered'
                },
            };
        case 'run_command':
            return {
                commands: [action.parameters?.command || 'ls'],
            };
        default:
            return {
                ...action.parameters
            };
    }
}

module.exports = { compileToKestraWorkflow };
