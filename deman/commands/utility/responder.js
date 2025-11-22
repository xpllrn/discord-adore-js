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
                
                // Fetch last 100 DMs with this user
                const userContextPath = path.join(contextDir, `${userId}.txt`);
                try {
                    const dmChannel = await bot.client.users.fetch(userId).then(u => u.createDM());
                    const messages = await dmChannel.messages.fetch({ limit: 100 });
                    
                    let contextText = '';
                    const sortedMessages = Array.from(messages.values()).reverse();
                    
                    for (const msg of sortedMessages) {
                        const author = msg.author.id === bot.ownerId ? 'ren' : msg.author.username;
                        contextText += `${author}: ${msg.content}\n`;
                    }
                    
                    fs.writeFileSync(userContextPath, contextText);
                    console.log(`[RESPONDER] Fetched ${messages.size} messages for context`);
                    
                    bot.saveConfig();
                    await webhook.sendOutput(`Auto-responder **enabled** for <@${userId}> (${messages.size} messages loaded)`);
                } catch (error) {
                    console.error('[RESPONDER] Failed to fetch messages:', error.message);
                    fs.writeFileSync(userContextPath, '');
                    bot.saveConfig();
                    await webhook.sendOutput(`Auto-responder **enabled** for <@${userId}> (no history loaded)`);
                }
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
