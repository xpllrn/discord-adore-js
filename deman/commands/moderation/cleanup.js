const webhook = require('../../utils/webhook');

module.exports = {
    name: 'cleanup',
    description: 'Toggle auto-cleanup or check status',
    async execute(message, args, bot) {
        const subcommand = args[0]?.toLowerCase();

        if (subcommand === 'on') {
            bot.cleanupEnabled = true;
            bot.saveConfig();
            await webhook.sendOutput('Auto-cleanup **enabled** (300s delay)');
        } else if (subcommand === 'off') {
            bot.cleanupEnabled = false;
            bot.saveConfig();
            await webhook.sendOutput('Auto-cleanup **disabled**');
        }
    }
};
