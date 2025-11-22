const webhook = require('../../utils/webhook');

module.exports = {
    name: 'status',
    description: 'Set your status',
    async execute(message, args, bot) {
        if (args.length === 0) return;

        const subcommand = args[0]?.toLowerCase();

        // Reset status
        if (subcommand === 'reset') {
            bot.statusConfig = {
                text: null,
                type: 'online',
                avatar: null,
                buttons: []
            };
            bot.saveConfig();
            try {
                bot.client.user.setPresence({
                    status: 'online',
                    activities: []
                });
                await webhook.sendOutput('Your status has been **successfully reset**');
            } catch (error) {
                console.error('[STATUS] Reset error:', error.message);
            }
            return;
        }

        // Set status text
        let statusType = 'online';
        let statusText = args.join(' ');

        if (statusText.includes('--offline')) {
            statusType = 'invisible';
            statusText = statusText.replace('--offline', '').trim();
        } else if (statusText.includes('--idle')) {
            statusType = 'idle';
            statusText = statusText.replace('--idle', '').trim();
        } else if (statusText.includes('--dnd')) {
            statusType = 'dnd';
            statusText = statusText.replace('--dnd', '').trim();
        } else if (statusText.includes('--online')) {
            statusType = 'online';
            statusText = statusText.replace('--online', '').trim();
        }

        try {
            bot.statusConfig.text = statusText;
            bot.statusConfig.type = statusType;
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput(`Your status is **successfully set** to \`${statusType}\``);
        } catch (error) {
            console.error('[STATUS] Error:', error.message);
        }
    }
};
