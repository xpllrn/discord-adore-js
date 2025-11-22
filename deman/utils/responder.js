const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Pending messages for double-text handling
const pendingMessages = new Map();

async function getAIResponse(userMessage, userId, userContext) {
    const stylePath = path.join(__dirname, '../context/ren_style.txt');
    let personalityBase = '';
    
    if (fs.existsSync(stylePath)) {
        personalityBase = fs.readFileSync(stylePath, 'utf8');
    }

    const systemPrompt = `You are ren. Reply EXACTLY like ren does.

REN'S ACTUAL MESSAGES (learn from these):
${personalityBase}

CONVERSATION HISTORY WITH THIS USER:
${userContext.slice(-2000)}

CRITICAL RULES - FOLLOW EXACTLY:
1. Keep responses SHORT (1-2 lines, max 20 words usually)
2. Use lowercase mostly (capitalize rarely)
3. Use ren's slang: "ion" (I don't), "u" (you), "wtv" (whatever), "oml" (oh my lord), "lmfao", "bruh", "nvm" (nevermind), "wym" (what you mean), "hruu" (how are you)
4. Add emojis naturally: 😭 (when laughing/crying), 😋 (playful), ☹️ (sad), 🤗 (happy)
5. Be casual, direct, sometimes sarcastic
6. Don't be overly helpful or formal - be real
7. Match ren's energy - chill, sometimes dry
8. Use "..." when trailing off or thinking
9. Sometimes just send single words like "bruh", "what", "oh"
10. Double text if needed (send 2-3 short messages instead of 1 long one)

EXAMPLES OF REN'S STYLE:
- "ion like it here"
- "u reply so late oml"
- "what's wrong"
- "bruh"
- "😭 😭 😭"
- "nvm"
- "wym"
- "idk then, that's on u 😭"

User message: ${userMessage}

Reply as ren (short, casual, natural):`;

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
                contents: [{
                    parts: [{
                        text: systemPrompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.95,
                    maxOutputTokens: 80,
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': process.env.GEMINI_API_KEY
                }
            }
        );

        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('[RESPONDER] AI Error:', error.message);
        return null;
    }
}

async function handleMessage(message, bot) {
    // Only respond to DMs
    if (!message.channel.isDMBased()) return;
    
    // Don't respond to self
    if (message.author.id === bot.ownerId) return;

    // Check if responder is enabled for this user
    if (!bot.responderEnabled.includes(message.author.id)) return;

    // Load user context
    const userContextPath = path.join(__dirname, '../context', `${message.author.id}.txt`);
    let userContext = '';
    if (fs.existsSync(userContextPath)) {
        userContext = fs.readFileSync(userContextPath, 'utf8');
    }

    // Handle double texting - wait for more messages
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

            // Combine all pending messages
            const combinedMessage = pending.messages.join('\n');

            // Show typing
            await message.channel.sendTyping();

            // Random delay (500-1500ms) to seem more human
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

            // Get AI response
            const response = await getAIResponse(combinedMessage, userId, userContext);
            
            if (response) {
                // Update context with new messages
                const newContext = `${message.author.username}: ${combinedMessage}\nren: ${response}\n`;
                fs.appendFileSync(userContextPath, newContext);

                // Send response
                await message.channel.send(response);
            }
        }, 2500) // Wait 2.5 seconds for more messages
    });
}

module.exports = {
    handleMessage
};
