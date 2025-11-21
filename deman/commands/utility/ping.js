module.exports = {
    name: 'ping',
    description: 'Check bot latency',
    async execute(message, args, bot) {
        const start = Date.now();
        const msg = await message.channel.send('🏓');
        const latency = Date.now() - start;
        
        await msg.edit(`\`${latency}ms\` | \`${Math.round(bot.client.ws.ping)}ms\``);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
    }
};
