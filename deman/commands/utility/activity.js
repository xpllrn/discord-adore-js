const webhook = require('../../utils/webhook');

module.exports = {
    name: 'activity',
    description: 'Manage custom activity',
    async execute(message, args, bot) {
        if (args.length === 0) return;

        const subcommand = args[0]?.toLowerCase();

        // .activity text <text>
        if (subcommand === 'text') {
            const text = args.slice(1).join(' ');
            if (!text) return;
            
            bot.statusConfig.text = text;
            bot.statusConfig.enabled = true;
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput(`Activity text set to: \`${text}\``);
            return;
        }

        // .activity subtext <text>
        if (subcommand === 'subtext') {
            const subtext = args.slice(1).join(' ');
            if (!subtext) return;
            
            bot.statusConfig.subtext = subtext;
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput(`Activity subtext set to: \`${subtext}\``);
            return;
        }

        // .activity avatar <link> or attach or @user
        if (subcommand === 'avatar') {
            let imageUrl = args[1] || message.attachments.first()?.url;
            
            // Check if it's a user mention
            if (args[1] && args[1].startsWith('<@') && args[1].endsWith('>')) {
                const userId = args[1].replace(/[<@!>]/g, '');
                try {
                    const user = await bot.client.users.fetch(userId);
                    imageUrl = user.displayAvatarURL({ dynamic: true, size: 512 });
                } catch (error) {
                    console.error('[ACTIVITY] Failed to fetch user:', error.message);
                    return;
                }
            }
            
            if (!imageUrl) return;
            
            bot.statusConfig.avatar = imageUrl;
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput(`Activity avatar updated`);
            return;
        }

        // .activity subavatar <link> or attach or @user
        if (subcommand === 'subavatar') {
            let imageUrl = args[1] || message.attachments.first()?.url;
            
            // Check if it's a user mention
            if (args[1] && args[1].startsWith('<@') && args[1].endsWith('>')) {
                const userId = args[1].replace(/[<@!>]/g, '');
                try {
                    const user = await bot.client.users.fetch(userId);
                    imageUrl = user.displayAvatarURL({ dynamic: true, size: 512 });
                } catch (error) {
                    console.error('[ACTIVITY] Failed to fetch user:', error.message);
                    return;
                }
            }
            
            if (!imageUrl) return;
            
            bot.statusConfig.subavatar = imageUrl;
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput(`Activity sub-avatar updated`);
            return;
        }

        // .activity button <name> --<link>
        if (subcommand === 'button') {
            const buttonText = args.slice(1).join(' ');
            console.log(`[ACTIVITY] Button text: "${buttonText}"`);
            
            const separatorIndex = buttonText.indexOf(' --');
            console.log(`[ACTIVITY] Separator index: ${separatorIndex}`);
            
            if (separatorIndex === -1) {
                console.log('[ACTIVITY] No separator found');
                await webhook.sendOutput('Invalid format. Use: `.activity button <name> --<url>`');
                return;
            }
            
            const name = buttonText.substring(0, separatorIndex).trim();
            const url = buttonText.substring(separatorIndex + 3).trim();
            
            console.log(`[ACTIVITY] Button name: "${name}", URL: "${url}"`);
            
            if (!name || !url) {
                console.log('[ACTIVITY] Name or URL empty');
                await webhook.sendOutput('Button name and URL cannot be empty');
                return;
            }
            
            // Replace existing button or add new one (max 2 buttons)
            if (bot.statusConfig.buttons.length === 0) {
                bot.statusConfig.buttons.push({ label: name, url: url });
            } else {
                bot.statusConfig.buttons[0] = { label: name, url: url };
            }
            
            console.log(`[ACTIVITY] Buttons array:`, JSON.stringify(bot.statusConfig.buttons));
            console.log(`[ACTIVITY] Full statusConfig:`, JSON.stringify(bot.statusConfig));
            
            bot.saveConfig();
            bot.applyStatus();
            
            console.log(`[ACTIVITY] Button added: ${name}`);
            await webhook.sendOutput(`Button **${name}** added successfully`);
            return;
        }

        // .activity subbutton <name> --<link>
        if (subcommand === 'subbutton') {
            const buttonText = args.slice(1).join(' ');
            const separatorIndex = buttonText.indexOf(' --');
            
            if (separatorIndex === -1) {
                await webhook.sendOutput('Invalid format. Use: `.activity subbutton <name> --<url>`');
                return;
            }
            
            const name = buttonText.substring(0, separatorIndex).trim();
            const url = buttonText.substring(separatorIndex + 3).trim();
            
            if (!name || !url) {
                await webhook.sendOutput('Button name and URL cannot be empty');
                return;
            }
            
            // Add as second button (max 2 buttons)
            if (bot.statusConfig.buttons.length === 0) {
                bot.statusConfig.buttons.push({ label: '', url: '' });
            }
            if (bot.statusConfig.buttons.length === 1) {
                bot.statusConfig.buttons.push({ label: name, url: url });
            } else {
                bot.statusConfig.buttons[1] = { label: name, url: url };
            }
            
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput(`Sub-button **${name}** added successfully`);
            return;
        }

        // .activity set <play/watch/stream>
        if (subcommand === 'set') {
            const activityType = args[1]?.toLowerCase();
            
            const typeMap = {
                'play': 'PLAYING',
                'watch': 'WATCHING',
                'stream': 'STREAMING'
            };
            
            if (!typeMap[activityType]) return;
            
            bot.statusConfig.activityType = typeMap[activityType];
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput(`Your status is **successfully set** to \`${activityType}\``);
            return;
        }

        // .activity on
        if (subcommand === 'on') {
            bot.statusConfig.enabled = true;
            bot.saveConfig();
            bot.applyStatus();
            
            await webhook.sendOutput('Activity **enabled**');
            return;
        }

        // .activity off
        if (subcommand === 'off') {
            bot.statusConfig.enabled = false;
            bot.saveConfig();
            try {
                bot.client.user.setPresence({
                    status: bot.statusConfig.type || 'online',
                    activities: []
                });
                await webhook.sendOutput('Activity **disabled**');
            } catch (error) {
                console.error('[ACTIVITY] Off error:', error.message);
            }
            return;
        }
    }
};
