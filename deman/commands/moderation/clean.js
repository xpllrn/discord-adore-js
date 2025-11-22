const webhook = require('../../utils/webhook');

module.exports = {
    name: 'clean',
    description: 'Delete your last 100 messages',
    async execute(message, args, bot) {
        try {
            const messages = await message.channel.messages.fetch({ limit: 100 });
            const myMessages = messages.filter(m => m.author.id === bot.ownerId);
            
            let deleted = 0;
            for (const [id, msg] of myMessages) {
                try {
                    await msg.delete();
                    deleted++;
                    await bot.sleep(300, 600);
                } catch (error) {
                    // Skip if message already deleted
                }
            }
            
            await webhook.sendOutput(`**Cleaned** \`${deleted}\` messages`);
        } catch (error) {
            console.error('[CLEAN] Error:', error.message);
        }
    }
};
