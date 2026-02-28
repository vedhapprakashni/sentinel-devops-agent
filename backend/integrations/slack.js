const { WebClient } = require('@slack/web-api');

/**
 * Send an incident alert to Slack
 * @param {Object} incidentData - Details of the incident
 */
const sendIncidentAlert = async (incidentData) => {
    // Determine token: using SLACK_WEBHOOK_URL alias or SLACK_BOT_TOKEN
    const token = process.env.SLACK_BOT_TOKEN || process.env.SLACK_WEBHOOK_URL; 
    const channelId = process.env.SLACK_CHANNEL_ID;

    if (!token || !channelId) {
        console.warn("Slack Integration: Missing SLACK_BOT_TOKEN (or SLACK_WEBHOOK_URL) or SLACK_CHANNEL_ID.");
        return;
    }

    const client = new WebClient(token);
    const { type, id, title, description, status, severity } = incidentData;
    
    const blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Incident Alert: ${title || 'Unknown Incident'}`
            }
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": `*Status:*\n${status || 'Unknown'}`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Severity:*\n${severity || 'High'}`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Incident ID:*\n${id || 'N/A'}`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Type:*\n${type || 'N/A'}`
                }
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `*Description:*\n${description || 'No description provided.'}`
            }
        }
    ];

    // Add approval buttons if an incident is detected and needs approval
    if (status === 'incident.detected') {
        blocks.push({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Approve Recovery"
                    },
                    "style": "primary",
                    "value": `approve_${id}`,
                    "action_id": "approve_recovery"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Decline Recovery"
                    },
                    "style": "danger",
                    "value": `decline_${id}`,
                    "action_id": "decline_recovery"
                }
            ]
        });
    }

    try {
        await client.chat.postMessage({
            channel: channelId,
            text: `Incident Update: ${status} - ${title}`,
            blocks: blocks
        });
        console.log(`Slack alert sent for incident ${id}`);
    } catch (error) {
        console.error('Error sending Slack alert:', error);
    }
};

module.exports = {
    sendIncidentAlert
};
