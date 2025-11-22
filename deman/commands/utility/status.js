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
                bot.client.user.setPresence({
                    activities: []
                });
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
            const separatorIndex = fullText.indexOf(' --');
            
            if (separatorIndex === -1) return;
            
            const lyricsText = fullText.substring(separatorIndex + 3).trim();
            if (!lyricsText) return;
            
            // Split by newlines or multiple spaces to get individual lines
            const lines = lyricsText.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length === 0) return;
            
            bot.statusLoop = {
                enabled: true,
                lines: lines,
                currentIndex: 0
            };
            bot.saveConfig();
            
            // Start the loop
            if (bot.statusLoopInterval) {
                clearInterval(bot.statusLoopInterval);
            }
            
            bot.statusLoopInterval = setInterval(() => {
                if (!bot.statusLoop || !bot.statusLoop.enabled) {
                    clearInterval(bot.statusLoopInterval);
                    return;
                }
                
                const currentLine = bot.statusLoop.lines[bot.statusLoop.currentIndex];
                
                try {
                    bot.client.user.setPresence({
                        activities: [{
                            type: 'CUSTOM',
                            name: 'Custom Status',
                            state: currentLine
                        }]
                    });
                } catch (error) {
                    console.error('[STATUS] Loop error:', error.message);
                }
                
                bot.statusLoop.currentIndex = (bot.statusLoop.currentIndex + 1) % bot.statusLoop.lines.length;
            }, 5000);
            
            await webhook.sendOutput(`Status loop **enabled** with ${lines.length} lines (5s interval)`);
            return;
        }

        // .status loop off
        if (subcommand === 'loop' && args[1]?.toLowerCase() === 'off') {
            if (bot.statusLoopInterval) {
                clearInterval(bot.statusLoopInterval);
                bot.statusLoopInterval = null;
            }
            
            bot.statusLoop = {
                enabled: false,
                lines: [],
                currentIndex: 0
            };
            bot.saveConfig();
            
            try {
                bot.client.user.setPresence({
                    activities: []
                });
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
            bot.client.user.setPresence({
                activities: [{
                    type: 'CUSTOM',
                    name: 'Custom Status',
                    state: statusText
                }]
            });
            await webhook.sendOutput(`Custom status set to: \`${statusText}\``);
        } catch (error) {
            console.error('[STATUS] Set error:', error.message);
        }
    }
};
