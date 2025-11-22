const webhook = require('../../utils/webhook');

module.exports = {
    name: 'help',
    description: 'Show available commands and their usage',
    async execute(message, args, bot) {
        const category = args[0]?.toLowerCase();

        // Command categories with their commands
        const categories = {

            activity: {
                title: 'Activity',
                commands: [
                    { cmd: '.activity text <text>', desc: 'Set activity text' },
                    { cmd: '.activity subtext <text>', desc: 'Set activity subtext/state' },
                    { cmd: '.activity avatar <link/@user/attach>', desc: 'Set activity large avatar image' },
                    { cmd: '.activity subavatar <link/@user/attach>', desc: 'Set activity small avatar image' },
                    { cmd: '.activity button <name> --<link>', desc: 'Add/update first button' },
                    { cmd: '.activity subbutton <name> --<link>', desc: 'Add/update second button' },
                    { cmd: '.activity set <play/watch/stream>', desc: 'Set activity type' },
                    { cmd: '.activity on', desc: 'Enable custom activity' },
                    { cmd: '.activity off', desc: 'Disable custom activity' }
                ]
            },
            status: {
                title: 'Status',
                commands: [
                    { cmd: '.status', desc: 'Clear custom status' },
                    { cmd: '.status <text>', desc: 'Set custom status text' },
                    { cmd: '.status loop on -- <lines>', desc: 'Loop through status lines (5s interval)' },
                    { cmd: '.status loop off', desc: 'Stop status loop' }
                ]
            },

            utility: {
                title: 'Utility',
                commands: [
                    { cmd: '.ping', desc: 'Check bot latency' },
                    { cmd: '.ask <question>', desc: 'Ask AI a question' },
                    { cmd: '.help', desc: 'Show all command categories' },
                    { cmd: '.help <category>', desc: 'Show commands for a specific category' }
                ]
            }
        };

        // If no category specified, show all categories
        if (!category) {
            let output = '**Available Commands**\n\n';
            const categoryNames = Object.keys(categories);
            
            categoryNames.forEach((cat, index) => {
                const num = String(index + 1).padStart(2, '0');
                output += `\`${num}\` **${categories[cat].title}**\n`;
            });
            
            output += `\nUse \`.help <category>\` to see specific commands\nExample: \`.help activity\` or \`.help status\``;
            
            await webhook.sendOutput(output);
            return;
        }

        // Show specific category commands
        if (categories[category]) {
            const cat = categories[category];
            let output = `**${cat.title} Commands**\n\n`;
            
            cat.commands.forEach((cmd, index) => {
                output += `\`${cmd.cmd}\`\n${cmd.desc}\n\n`;
            });
            
            await webhook.sendOutput(output);
        } else {
            await webhook.sendOutput(`Category \`${category}\` not found. Use \`.help\` to see all categories.`);
        }
    }
};
