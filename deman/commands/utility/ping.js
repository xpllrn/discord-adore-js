module.exports = {
    name: 'ping',
    description: 'Check bot latency',
    async execute(message, args, bot) {
        const start = Date.now();
        const msg = await message.channel.send('pinging...');
        const latency = Date.now() - start;
        
        await msg.edit(`${latency}ms`);
    }
};
