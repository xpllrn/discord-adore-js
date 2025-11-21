module.exports = {
    name: 'ping',
    description: 'Check bot latency',
    async execute(message, args, bot) {
        const start = Date.now();
        const msg = await message.channel.send('🏓 Pinging...');
        const latency = Date.now() - start;
        
        await msg.edit(`🏓 Pong! \`${latency}ms\` | API: \`${Math.round(bot.client.ws.ping)}ms\``);
        
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (error) {}
        }, 5000);
    }
};
