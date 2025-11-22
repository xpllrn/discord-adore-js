const webhook = require('../../utils/webhook');

module.exports = {
    name: 'spam',
    description: 'Spam messages',
    async execute(message, args, bot) {
        if (args[0] === 'stop') {
            let stopped = 0;
            for (const [channelId, interval] of bot.spamIntervals) {
                clearInterval(interval);
                bot.spamIntervals.delete(channelId);
                stopped++;
            }
            await webhook.sendOutput(`**Stopped** \`${stopped}\` spam process(es)`);
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

        await webhook.sendOutput(`**Spamming** \`${count}\` times...`);

        let sent = 0;
        const spamInterval = setInterval(async () => {
            if (sent >= count) {
                clearInterval(spamInterval);
                bot.spamIntervals.delete(message.channel.id);
                await webhook.sendOutput(`**Completed** spam: \`${count}\` messages sent`);
                return;
            }

            await message.channel.send(text).catch(() => {});
            sent++;
        }, Math.floor(Math.random() * 500) + 500);

        bot.spamIntervals.set(message.channel.id, spamInterval);
    }
};
