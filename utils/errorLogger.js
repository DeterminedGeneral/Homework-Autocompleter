const axios = require('axios');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function logError(error, userId, tool, additionalInfo = '') {
    try {
        const timestamp = new Date().toISOString();
        const errorMessage = error.message || 'Unknown error';
        const errorStack = error.stack || 'No stack trace available';

        const embed = {
            title: '🚨 Bot Error Encountered',
            color: 0xFF0000,
            fields: [
                { name: 'Tool', value: tool, inline: true },
                { name: 'User ID', value: userId || 'Unknown', inline: true },
                { name: 'Timestamp', value: timestamp, inline: true },
                { name: 'Error Message', value: `\`\`\`${errorMessage}\`\`\``, inline: false },
                { name: 'Stack Trace', value: `\`\`\`${errorStack.substring(0, 1000)}\`\`\``, inline: false }
            ],
            timestamp: timestamp
        };

        if (additionalInfo) {
            embed.fields.push({ name: 'Additional Info', value: additionalInfo, inline: false });
        }

        if (!WEBHOOK_URL) {
            // console.error('WEBHOOK_URL is not defined in .env');
            return;
        }

        const filePath = path.resolve('logs.txt');
        const form = new FormData();

        // Only attach file if it exists
        if (fs.existsSync(filePath)) {
            form.append('file', fs.createReadStream(filePath));
        }

        form.append('payload_json', JSON.stringify({ embeds: [embed] }));

        await axios.post(WEBHOOK_URL, form, { headers: form.getHeaders() });

        console.log(`Error logged to webhook for tool: ${tool}, user: ${userId}`);
    } catch (webhookError) {
        console.error('Failed to send error to webhook:', webhookError.message);
    }
}

module.exports = { logError };