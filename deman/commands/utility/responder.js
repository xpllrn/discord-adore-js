const fs = require('fs');
const path = require('path');
const webhook = require('../../utils/webhook');

module.exports = {
    name: 'responder',
    description: 'Enable/disable AI auto-responder for a user',
    async execute(message, args, bot) {
        if (args.length < 2) return;

        const action = args[0].toLowerCase();
        const userId = args[1];

        if (!['enable', 'disable'].includes(action)) return;

        const contextDir = path.join(__dirname, '../../context');

        if (!fs.existsSync(contextDir)) {
            fs.mkdirSync(contextDir, { recursive: true });
        }

        if (action === 'enable') {
            if (!bot.responderEnabled.includes(userId)) {
                bot.responderEnabled.push(userId);
                
                const userContextPath = path.join(contextDir, `${userId}.txt`);
                if (!fs.existsSync(userContextPath)) {
                    fs.writeFileSync(userContextPath, '');
                }
                
                bot.saveConfig();
                await webhook.sendOutput(`Auto-responder **enabled** for <@${userId}>`);
            }
        } else {
            const index = bot.responderEnabled.indexOf(userId);
            if (index > -1) {
                bot.responderEnabled.splice(index, 1);
                bot.saveConfig();
                await webhook.sendOutput(`Auto-responder **disabled** for <@${userId}>`);
            }
        }
    }
};
