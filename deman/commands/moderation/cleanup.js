module.exports = {
    name: 'cleanup',
    description: 'Toggle auto-cleanup or check status',
    async execute(message, args, bot) {
        const subcommand = args[0]?.toLowerCase();

        if (subcommand === 'on') {
            bot.cleanupEnabled = true;
        } else if (subcommand === 'off') {
            bot.cleanupEnabled = false;
        }
    }
};
