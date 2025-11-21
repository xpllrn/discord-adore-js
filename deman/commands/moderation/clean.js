module.exports = {
    name: 'clean',
    description: 'Delete your last 100 messages',
    async execute(message, args, bot) {
        const statusMsg = await message.channel.send('🧹 Cleaning messages...');
        
        try {
            const messages = await message.channel.messages.fetch({ limit: 100 });
            const myMessages = messages.filter(m => m.author.id === bot.client.user.id);
            
            let deleted = 0;
            for (const [id, msg] of myMessages) {
                try {
                    await msg.delete();
                    deleted++;
                    await bot.sleep(500, 1000);
                } catch (error) {
                    // Can't delete, skip
                }
            }
            
            await statusMsg.edit(`✅ Deleted ${deleted} messages`);
            setTimeout(() => statusMsg.delete().catch(() => {}), 3000);
        } catch (error) {
            await statusMsg.edit('❌ Failed to clean messages');
            setTimeout(() => statusMsg.delete().catch(() => {}), 3000);
        }
    }
};
