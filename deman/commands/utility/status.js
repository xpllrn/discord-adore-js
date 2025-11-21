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
            await bot.client.user.setPresence({
                status: 'online',
                activities: []
            }).catch(() => {});
            return;
        }

        // Set avatar for activity
        if (subcommand === 'av') {
            const imageUrl = args[1] || message.attachments.first()?.url;
            if (!imageUrl) return;
            
            bot.statusConfig.avatar = imageUrl;
            bot.saveConfig();
            bot.applyStatus();
            return;
        }

        // Add button to status
        if (subcommand === 'button') {
            const buttonText = args.slice(1).join(' ');
            const urlMatch = buttonText.match(/--(.+)/);
            
            if (!urlMatch) return;
            
            const name = buttonText.replace(/--(.+)/, '').trim();
            const url = urlMatch[1].trim();
            
            bot.statusConfig.buttons.push({ label: name, url: url });
            bot.saveConfig();
            bot.applyStatus();
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

        bot.statusConfig.text = statusText;
        bot.statusConfig.type = statusType;
        bot.saveConfig();
        bot.applyStatus();
    }
};
