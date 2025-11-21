module.exports = {
    name: 'clean',
    description: 'Delete your last 100 messages',
    async execute(message, args, bot) {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const myMessages = messages.filter(m => m.author.id === bot.ownerId);
        
        for (const [id, msg] of myMessages) {
            await msg.delete().catch(() => {});
            await bot.sleep(300, 600);
        }
    }
};
