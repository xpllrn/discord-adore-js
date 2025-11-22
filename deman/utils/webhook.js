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

    async sendDeletedMessage(data) {
        if (!this.deletedDmsUrl) return;

        const embed = {
            author: {
                name: data.author.tag || 'Unknown',
                icon_url: data.author.displayAvatarURL?.() || data.author.avatarURL?.() || undefined
            },
            description: data.content,
            color: 0xf44336,
            footer: {
                text: `Deleted at ${data.deletedAt.toLocaleString()}`
            },
            timestamp: data.deletedAt.toISOString()
        };

        try {
            await axios.post(this.deletedDmsUrl, {
                embeds: [embed]
            });
        } catch (error) {
            console.error('[WEBHOOK] Failed to send deleted message:', error.message);
        }
    }

    async sendEditedMessage(data) {
        if (!this.deletedDmsUrl) return;

        const embed = {
            author: {
                name: data.author.tag || 'Unknown',
                icon_url: data.author.displayAvatarURL?.() || data.author.avatarURL?.() || undefined
            },
            fields: [
                {
                    name: '**Before**',
                    value: data.oldContent.length > 1024 ? data.oldContent.substring(0, 1021) + '...' : data.oldContent,
                    inline: false
                },
                {
                    name: '**After**',
                    value: data.newContent.length > 1024 ? data.newContent.substring(0, 1021) + '...' : data.newContent,
                    inline: false
                }
            ],
            color: 0xf29c1e,
            footer: {
                text: `Edited at ${data.editedAt.toLocaleString()}`
            },
            timestamp: data.editedAt.toISOString()
        };

        try {
            await axios.post(this.deletedDmsUrl, {
                embeds: [embed]
            });
        } catch (error) {
            console.error('[WEBHOOK] Failed to send edited message:', error.message);
        }
    }
}

module.exports = new WebhookLogger();
