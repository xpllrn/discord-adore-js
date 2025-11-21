module.exports = {
    name: 'spam',
    description: 'Spam messages',
    async execute(message, args, bot) {
        if (args[0] === 'stop') {
            for (const [channelId, interval] of bot.spamIntervals) {
                clearInterval(interval);
                bot.spamIntervals.delete(channelId);
            }
            return;
        }

        let count = 5;
        let text = args.join(' ');
        
        const countMatch = text.match(/--(\d+)/);
        if (countMatch) {
            count = parseInt(countMatch[1]);
            text = text.replace(/--\d+/, '').trim();
        }

        if (!text) return;

        let sent = 0;
        const spamInterval = setInterval(async () => {
            if (sent >= count) {
                clearInterval(spamInterval);
                bot.spamIntervals.delete(message.channel.id);
                return;
            }

            await message.channel.send(text).catch(() => {});
            sent++;
        }, Math.floor(Math.random() * 500) + 500); // 500-1000ms

        bot.spamIntervals.set(message.channel.id, spamInterval);
    }
};
