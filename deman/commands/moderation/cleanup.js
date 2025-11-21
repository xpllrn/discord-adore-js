module.exports = {
    name: 'cleanup',
    description: 'Toggle auto-cleanup or check status',
    async execute(message, args, bot) {
        const subcommand = args[0]?.toLowerCase();

        if (subcommand === 'on') {
            bot.cleanupEnabled = true;
            const msg = await message.channel.send('✅ Auto-cleanup enabled (300s delay)');
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } else if (subcommand === 'off') {
            bot.cleanupEnabled = false;
            const msg = await message.channel.send('❌ Auto-cleanup disabled');
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } else {
            const status = bot.cleanupEnabled ? '✅ ON' : '❌ OFF';
            const msg = await message.channel.send(`Auto-cleanup is currently: ${status}`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        }
    }
};
