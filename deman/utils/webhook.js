const axios = require('axios');

class WebhookLogger {
    constructor() {
        this.deletedDmsUrl = process.env.DELETED_DMS_WEBHOOK;
        this.terminalLogsUrl = process.env.TERMINAL_LOGS_WEBHOOK;
        this.outputUrl = process.env.OUTPUT_WEBHOOK;
    }

    async sendOutput(message) {
        if (!this.outputUrl) return;

        const embed = {
            description: message,
            color: 0x51e395,
        };

        try {
            await axios.post(this.outputUrl, {
                embeds: [embed]
            });
        } catch (error) {
            console.error('[WEBHOOK] Failed to send output:', error.message);
        }
    }

    async sendLog(message, type = 'info') {
        if (!this.terminalLogsUrl) return;

        const colors = {
            info: 0x5865F2,
            success: 0x51e395,
            error: 0xf44336,
            warn: 0xf29c1e
        };

        const embed = {
            title: `${type.toUpperCase()} Log`,
            description: message,
            color: colors[type] || colors.info,
            footer: {
                text: 'Selfbot Logger'
            }
        };

        try {
            await axios.post(this.terminalLogsUrl, {
                embeds: [embed]
            });
        } catch (error) {
            console.error('[WEBHOOK] Failed to send log:', error.message);
        }
    }

    async sendDeletedDM(data) {
        if (!this.deletedDmsUrl) return;

        const embed = {
            title: '🗑️ Deleted DM',
            fields: [
                {
                    name: 'From',
                    value: data.author || 'Unknown',
                    inline: true
                },
                {
                    name: 'Channel',
                    value: data.channel || 'Unknown',
                    inline: true
                },
                {
                    name: 'Content',
                    value: data.content || 'No content',
                    inline: false
                }
            ],
            color: 0xf44336,
        };

        try {
            await axios.post(this.deletedDmsUrl, {
                embeds: [embed]
            });
        } catch (error) {
            console.error('[WEBHOOK] Failed to send deleted DM:', error.message);
        }
    }
}

module.exports = new WebhookLogger();
