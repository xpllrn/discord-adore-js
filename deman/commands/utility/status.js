module.exports = {
    name: 'status',
    description: 'Set your status',
    async execute(message, args, bot) {
        if (args.length === 0) {
            const msg = await message.channel.send('❌ Usage: ,status <text> [--online/--idle/--dnd/--offline]');
            setTimeout(() => msg.delete().catch(() => {}), 3000);
            return;
        }

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
            await bot.client.user.setPresence({
                status: statusType,
                activities: [{
                    name: statusText,
                    type: 'PLAYING'
                }]
            });

            const msg = await message.channel.send(`✅ Status set to: ${statusText} (${statusType})`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } catch (error) {
            const msg = await message.channel.send('❌ Failed to set status');
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        }
    }
};
