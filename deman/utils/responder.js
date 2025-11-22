const axios = require('axios');
const fs = require('fs');
const path = require('path');

const pendingMessages = new Map();

async function getAIResponse(userMessage, userContext) {
    const prompt = `You are ren. Respond in ren's casual texting style.

RECENT CHAT:
${userContext.slice(-800)}

STYLE:
- lowercase, short (10-20 words max)
- slang: ion, u, wtv, oml, bruh, nvm, wym
- emojis: 😭 😋 ☹️ 🤗
- direct, chill, sometimes sarcastic

Their message: ${userMessage}

Your response (short, casual):`;

    try {
        const res = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 1.0, maxOutputTokens: 50, topP: 0.95 }
            },
            { headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GEMINI_API_KEY } }
        );
        return res.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('[RESPONDER] AI Error:', error.message);
        return null;
    }
}

async function handleMessage(message, bot) {
    if (message.channel.type !== 'DM') return;
    if (message.author.id === bot.ownerId) return;
    if (!bot.responderEnabled.includes(message.author.id)) return;

    const userContextPath = path.join(__dirname, '../context', `${message.author.id}.txt`);
    let userContext = '';
    if (fs.existsSync(userContextPath)) {
        userContext = fs.readFileSync(userContextPath, 'utf8');
    }

    const userId = message.author.id;
    
    if (pendingMessages.has(userId)) {
        clearTimeout(pendingMessages.get(userId).timeout);
    }

    pendingMessages.set(userId, {
        messages: pendingMessages.has(userId) 
            ? [...pendingMessages.get(userId).messages, message.content]
            : [message.content],
        timeout: setTimeout(async () => {
            const pending = pendingMessages.get(userId);
            pendingMessages.delete(userId);

            const combinedMessage = pending.messages.join('\n');

            await message.channel.sendTyping();
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

            const response = await getAIResponse(combinedMessage, userContext);
            
            if (response) {
                const newContext = `${message.author.username}: ${combinedMessage}\nren: ${response}\n`;
                
                // Keep only last 50 messages
                let fullContext = userContext + newContext;
                const lines = fullContext.split('\n').filter(l => l.trim());
                if (lines.length > 100) {
                    fullContext = lines.slice(-100).join('\n') + '\n';
                }
                
                fs.writeFileSync(userContextPath, fullContext);
                await message.channel.send(response);
            }
        }, 2500)
    });
}

module.exports = { handleMessage };
