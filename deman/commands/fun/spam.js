module.exports = {
    name: 'spam',
    description: 'Spam messages',
    async execute(message, args, bot) {
        if (args[0] === 'stop') {
            for (const [channelId, interval] of bot.spamIntervals) {
                clearInterval(interval);
                bot.spamIntervals.delete(channelId);
            }
            const msg = await message.channel.send('⏹️ Stopped all spam');
            setTimeout(() => msg.delete().catch(() => {}), 3000);
            return;
        }

        let count = 5;
        let text = args.join(' ');
        
        const countMatch = text.match(/--(\d+)/);
        if (countMatch) {
            count = parseInt(countMatch[1]);
            text = text.replace(/--\d+/, '').trim();
        }

        if (!text) {
            const msg = await message.channel.send('❌ Usage: ,spam <text> [--count]');
            setTimeout(() => msg.delete().catch(() => {}), 3000);
            return;
        }

        const statusMsg = await message.channel.send(`🔄 Spamming ${count} times...`);

        let sent = 0;
        const spamInterval = setInterval(async () => {
            if (sent >= count) {
                clearInterval(spamInterval);
                bot.spamIntervals.delete(message.channel.id);
                await statusMsg.edit(`✅ Sent ${count} messages`);
                setTimeout(() => statusMsg.delete().catch(() => {}), 3000);
                return;
            }

            try {
                await message.channel.send(text);
                sent++;
            } catch (error) {
                console.error('[SPAM] Error:', error.message);
            }
        }, Math.floor(Math.random() * 1000) + 1500);

        bot.spamIntervals.set(message.channel.id, spamInterval);
    }
};
