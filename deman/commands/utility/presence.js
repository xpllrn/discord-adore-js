const webhook = require('../../utils/webhook');

module.exports = {
    name: 'presence',
    description: 'Change your Discord presence status',
    async execute(message, args, bot) {
        if (args.length === 0) return;

        const presenceType = args[0]?.toLowerCase();
        
        const validPresences = {
            'online': 'online',
            'idle': 'idle',
            'dnd': 'dnd',
            'invisible': 'invisible',
            'offline': 'invisible'
        };
        
        if (!validPresences[presenceType]) {
            await webhook.sendOutput('Invalid presence. Use: `online`, `idle`, `dnd`, or `invisible`');
            return;
        }
        
        try {
            bot.statusConfig.type = validPresences[presenceType];
            bot.saveConfig();
            
            // Reapply activity with new presence if activity is enabled
            if (bot.statusConfig.enabled) {
                bot.applyStatus();
            } else {
                // Just change presence without activity
                bot.client.user.setPresence({
                    status: validPresences[presenceType],
                    activities: []
                });
            }
            
            await webhook.sendOutput(`Presence changed to **${presenceType}**`);
        } catch (error) {
            console.error('[PRESENCE] Error:', error.message);
        }
    }
};
