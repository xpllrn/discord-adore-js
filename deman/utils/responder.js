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
    
    // Get last 20 lines for better context understanding
    const contextLines = userContext.split('\n').filter(l => l.trim()).slice(-20);
    
    // Build conversation context with clear structure
    let conversationContext = '';
    for (const line of contextLines) {
        conversationContext += line + '\n';
    }
    
    const prompt = `You are ren texting a friend. Read the FULL conversation to understand context, then reply naturally.

CONVERSATION HISTORY (read carefully to understand what's being discussed):
${conversationContext}

THEIR NEW MESSAGE:
${userMessage}

YOUR STYLE (ren):
- ${personality?.style.avgWordCount || 6} words average
- ${personality?.style.lowercasePercent || 100}% lowercase
- Direct, chill, minimal
- Slang: ion, u, wtv, hoe, nvm, wym, alr
- NO emojis unless they use one (max 1)

CRITICAL RULES:
1. UNDERSTAND the conversation context first
2. Reply naturally to what they ACTUALLY said
3. Max 12 words
4. NO emojis unless they used one
5. NO repeated phrases
6. Stay on topic

Format: RESPONSE: <your reply>`;

    try {
        const res = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.75, maxOutputTokens: 35, topP: 0.85 }
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
