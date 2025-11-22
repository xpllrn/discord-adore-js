const webhook = require('../../utils/webhook');

module.exports = {
    name: 'status',
    description: 'Manage custom status text',
    async execute(message, args, bot) {
        // .status (no args) - clear status
        if (args.length === 0) {
            bot.customStatus = null;
            bot.saveConfig();
            
            try {
                // Reapply activity if enabled, otherwise clear all
                if (bot.statusConfig.enabled) {
                    bot.applyStatus();
                } else {
                    bot.client.user.setPresence({
                        status: bot.statusConfig.type || 'online',
                        activities: []
                    });
                }
                await webhook.sendOutput('Custom status **cleared**');
            } catch (error) {
                console.error('[STATUS] Clear error:', error.message);
            }
            return;
        }

        const subcommand = args[0]?.toLowerCase();

        // .status loop on -- <text with lines>
        if (subcommand === 'loop' && args[1]?.toLowerCase() === 'on') {
            const fullText = args.slice(2).join(' ');
            
            // Look for -- with or without space before it
            let separatorIndex = fullText.indexOf(' --');
            if (separatorIndex === -1) {
                separatorIndex = fullText.indexOf('--');
            }
            
            if (separatorIndex === -1) {
                await webhook.sendOutput('Invalid format. Use: `.status loop on -- <text>` or `.status loop on --<text>`');
                return;
            }
            
            // Determine how many characters to skip based on separator format
            const skipChars = fullText[separatorIndex] === ' ' ? 3 : 2;
            const lyricsText = fullText.substring(separatorIndex + skipChars).trim();
            
            if (!lyricsText) {
                await webhook.sendOutput('No text provided after `--`');
                return;
            }
            
            // Split by newlines or multiple spaces to get individual lines
            const lines = lyricsText.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length === 0) {
                await webhook.sendOutput('No valid lines found');
                return;
            }
            
            bot.statusLoop = {
                enabled: true,
                lines: lines,
                currentIndex: 0
            };
            bot.saveConfig();
            
            // Start the loop with random interval
            if (bot.statusLoopInterval) {
                clearInterval(bot.statusLoopInterval);
            }
            
            const updateStatus = () => {
                if (!bot.statusLoop || !bot.statusLoop.enabled) {
                    if (bot.statusLoopInterval) {
                        clearInterval(bot.statusLoopInterval);
                    }
                    return;
                }
                
                const currentLine = bot.statusLoop.lines[bot.statusLoop.currentIndex];
                
                try {
                    const { CustomStatus } = require('discord.js-selfbot-v13');
                    const customStatus = new CustomStatus(bot.client)
                        .setState(currentLine);
                    
                    // Get current activities to preserve rich presence if enabled
                    const activities = [];
                    
                    // Add rich presence if activity is enabled
                    if (bot.statusConfig.enabled && bot.statusConfig.text) {
                        const { RichPresence } = require('discord.js-selfbot-v13');
                        const rpc = new RichPresence(bot.client)
                            .setApplicationId('1234567890')
                            .setType(bot.statusConfig.activityType || 'PLAYING')
                            .setName(bot.statusConfig.text);

                        if (bot.statusConfig.subtext) {
                            rpc.setState(bot.statusConfig.subtext);
                        }
                        if (bot.statusConfig.avatar) {
                            rpc.setAssetsLargeImage(bot.statusConfig.avatar);
                        }
                        if (bot.statusConfig.subavatar) {
                            rpc.setAssetsSmallImage(bot.statusConfig.subavatar);
                        }
                        if (bot.statusConfig.buttons.length > 0) {
                            bot.statusConfig.buttons.forEach(btn => {
                                if (btn.label && btn.url) {
                                    rpc.addButton(btn.label, btn.url);
                                }
                            });
                        }
                        activities.push(rpc);
                    }
                    
                    // Add custom status
                    activities.push(customStatus);
                    
                    bot.client.user.setPresence({
                        status: bot.statusConfig.type || 'online',
                        activities: activities
                    });
                } catch (error) {
                    console.error('[STATUS] Loop error:', error.message);
                }
                
                bot.statusLoop.currentIndex = (bot.statusLoop.currentIndex + 1) % bot.statusLoop.lines.length;
                
                // Schedule next update with random interval (6-10 seconds)
                const randomInterval = Math.floor(Math.random() * (10000 - 6000 + 1)) + 6000;
                bot.statusLoopTimeout = setTimeout(updateStatus, randomInterval);
            };
            
            // Start the first update immediately
            updateStatus();
            
            await webhook.sendOutput(`Status loop **enabled** with ${lines.length} lines (6-10s random interval)`);
            return;
        }

        // .status loop off
        if (subcommand === 'loop' && args[1]?.toLowerCase() === 'off') {
            if (bot.statusLoopInterval) {
                clearInterval(bot.statusLoopInterval);
                bot.statusLoopInterval = null;
            }
            if (bot.statusLoopTimeout) {
                clearTimeout(bot.statusLoopTimeout);
                bot.statusLoopTimeout = null;
            }
            
            bot.statusLoop = {
                enabled: false,
                lines: [],
                currentIndex: 0
            };
            bot.saveConfig();
            
            try {
                // Reapply activity if enabled, otherwise clear all
                if (bot.statusConfig.enabled) {
                    bot.applyStatus();
                } else {
                    bot.client.user.setPresence({
                        status: bot.statusConfig.type || 'online',
                        activities: []
                    });
                }
                await webhook.sendOutput('Status loop **disabled**');
            } catch (error) {
                console.error('[STATUS] Loop off error:', error.message);
            }
            return;
        }

        // .status <text> - set single custom status
        const statusText = args.join(' ');
        
        bot.customStatus = statusText;
        bot.saveConfig();
        
        try {
            const { CustomStatus } = require('discord.js-selfbot-v13');
            const customStatus = new CustomStatus(bot.client)
                .setState(statusText);
            
            // Get current activities to preserve rich presence if enabled
            const activities = [];
            
            // Add custom status FIRST
            activities.push(customStatus);
            
            // Add rich presence if activity is enabled
            if (bot.statusConfig.enabled && bot.statusConfig.text) {
                const { RichPresence } = require('discord.js-selfbot-v13');
                const rpc = new RichPresence(bot.client)
                    .setApplicationId('1234567890')
                    .setType(bot.statusConfig.activityType || 'PLAYING')
                    .setName(bot.statusConfig.text);

                if (bot.statusConfig.subtext) {
                    rpc.setState(bot.statusConfig.subtext);
                }
                if (bot.statusConfig.avatar) {
                    rpc.setAssetsLargeImage(bot.statusConfig.avatar);
                }
                if (bot.statusConfig.subavatar) {
                    rpc.setAssetsSmallImage(bot.statusConfig.subavatar);
                }
                if (bot.statusConfig.buttons.length > 0) {
                    bot.statusConfig.buttons.forEach(btn => {
                        if (btn.label && btn.url) {
                            rpc.addButton(btn.label, btn.url);
                        }
                    });
                }
                activities.push(rpc);
            }
            
            bot.client.user.setPresence({
                status: bot.statusConfig.type || 'online',
                activities: activities
            });
            
            await webhook.sendOutput(`Custom status set to: \`${statusText}\``);
        } catch (error) {
            console.error('[STATUS] Set error:', error.message);
            console.error(error.stack);
            await webhook.sendOutput(`Error setting status: ${error.message}`);
        }
    }
};
