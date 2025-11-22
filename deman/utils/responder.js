const axios = require('axios');
const fs = require('fs');
const path = require('path');

const pendingMessages = new Map();

function cleanMessage(text) {
    return text
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // remove emojis
        .replace(/\s+/g, ' ') // normalize spaces
        .trim();
}

function loadPersonality() {
    const personalityPath = path.join(__dirname, '../context/personality.json');
    if (fs.existsSync(personalityPath)) {
        return JSON.parse(fs.readFileSync(personalityPath, 'utf8'));
    }
    return null;
}

async function getAIResponse(userMessage, userContext) {
    const personality = loadPersonality();
    const contextLines = userContext.split('\n').filter(l => l.trim()).slice(-12).join('\n');
    
    const styleRules = personality ? `
STYLE ANALYSIS:
- Average ${personality.style.avgWordCount} words per message
- ${personality.style.lowercasePercent}% lowercase
- ${personality.style.singleWordPercent}% single-word responses
- Top slang: ${Object.keys(personality.slang).slice(0, 5).join(', ')}
` : '';
    
    const prompt = `You are ren. You reply in a calm, short, minimal style.

You DO NOT use emojis unless the user uses one in the same message.
You NEVER repeat a sentence under any circumstance.
You NEVER add sexual jokes, flirty lines, or random suggestions.
You NEVER extend the conversation unless the user asks something.
You reply in lowercase, simple slang ONLY if the user uses slang.
${styleRules}
RULES:
1. No more than 12 words
2. No emojis unless mirrored from user (max 1)
3. No repeated words, no spam
4. Keep tone neutral unless user expresses strong emotion

RECENT CHAT (last 12 messages):
${contextLines}

User message: ${userMessage}

Your response MUST be formatted as:
RESPONSE: <your message here>`;

    try {
        const res = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 30, topP: 0.85, topK: 40 }
            },
            { headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GEMINI_API_KEY } }
        );
        
        let response = res.data.candidates[0].content.parts[0].text.trim();
        if (response.includes('RESPONSE:')) {
            response = response.split('RESPONSE:')[1].trim();
        }
        
        return response;
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
                // Clean messages before saving
                const cleanedUserMsg = cleanMessage(combinedMessage);
                const cleanedResponse = cleanMessage(response);
                
                const newContext = `${message.author.username}: ${cleanedUserMsg}\nren: ${cleanedResponse}\n`;
                
                // Keep only last 50 lines
                let fullContext = userContext + newContext;
                const lines = fullContext.split('\n').filter(l => l.trim());
                if (lines.length > 50) {
                    fullContext = lines.slice(-50).join('\n') + '\n';
                }
                
                fs.writeFileSync(userContextPath, fullContext);
                await message.channel.send(response);
            }
        }, 2500)
    });
}

module.exports = { handleMessage };
