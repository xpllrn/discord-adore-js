const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AutoResponder {
    constructor(bot) {
        this.bot = bot;
        this.contextDir = path.join(__dirname, '../context');
        this.configPath = path.join(this.contextDir, 'responder.json');
        this.memoryPath = path.join(this.contextDir, 'memory.json');
        this.processing = new Set();
    }

    // Check if responder is enabled for user
    isEnabled(userId) {
        try {
            return this.bot.responderEnabled.includes(userId);
        } catch (error) {
            console.error('[RESPONDER] Error checking enabled:', error.message);
            return false;
        }
    }

    // Get chat history for user
    getChatHistory(userId) {
        try {
            const userContextPath = path.join(this.contextDir, `${userId}.txt`);
            if (!fs.existsSync(userContextPath)) return '';
            return fs.readFileSync(userContextPath, 'utf8');
        } catch (error) {
            console.error('[RESPONDER] Error reading history:', error.message);
            return '';
        }
    }

    // Save message to chat history (keep last 100)
    saveChatHistory(userId, author, content) {
        try {
            const userContextPath = path.join(this.contextDir, `${userId}.txt`);
            let history = '';
            
            if (fs.existsSync(userContextPath)) {
                history = fs.readFileSync(userContextPath, 'utf8');
            }

            // Add new message
            const timestamp = new Date().toISOString();
            const newLine = `[${timestamp}] ${author}: ${content}\n`;
            history += newLine;

            // Keep only last 100 messages
            const lines = history.split('\n').filter(line => line.trim());
            if (lines.length > 100) {
                history = lines.slice(-100).join('\n') + '\n';
            }

            fs.writeFileSync(userContextPath, history);
        } catch (error) {
            console.error('[RESPONDER] Error saving history:', error.message);
        }
    }

    // Get memories for user
    getMemories(userId) {
        try {
            if (!fs.existsSync(this.memoryPath)) return [];
            const data = JSON.parse(fs.readFileSync(this.memoryPath, 'utf8'));
            return data.memories.filter(m => m.userId === userId);
        } catch (error) {
            console.error('[RESPONDER] Error reading memories:', error.message);
            return [];
        }
    }

    // Save important memory
    saveMemory(userId, text) {
        try {
            let data = { memories: [] };
            if (fs.existsSync(this.memoryPath)) {
                data = JSON.parse(fs.readFileSync(this.memoryPath, 'utf8'));
            }

            data.memories.push({
                userId,
                text,
                timestamp: new Date().toISOString()
            });

            fs.writeFileSync(this.memoryPath, JSON.stringify(data, null, 2));
            console.log(`[RESPONDER] Saved memory for ${userId}`);
        } catch (error) {
            console.error('[RESPONDER] Error saving memory:', error.message);
        }
    }

    // Check if message contains important info to remember
    async checkForMemory(userId, content) {
        try {
            const keywords = [
                'remember', 'important', 'don\'t forget', 'keep in mind',
                'note that', 'fyi', 'just so you know', 'btw',
                'my birthday', 'my name', 'i like', 'i love', 'i hate',
                'favorite', 'address', 'phone', 'email'
            ];

            const lowerContent = content.toLowerCase();
            const shouldRemember = keywords.some(keyword => lowerContent.includes(keyword));

            if (shouldRemember) {
                this.saveMemory(userId, content);
            }
        } catch (error) {
            console.error('[RESPONDER] Error checking memory:', error.message);
        }
    }

    // Generate AI response
    async generateResponse(userId, message) {
        try {
            const history = this.getChatHistory(userId);
            const memories = this.getMemories(userId);
            
            const memoriesText = memories.length > 0 
                ? `\n\nIMPORTANT MEMORIES:\n${memories.map(m => `- ${m.text}`).join('\n')}`
                : '';

            const systemPrompt = `You are a real human boy who is currently studying. You're chatting naturally with a friend.

PERSONALITY:
- You're a student, so sometimes you're busy with studies
- You type like a real person - casual, sometimes typos, use slang
- You're friendly and genuine
- You don't always respond immediately or perfectly
- You use emojis naturally but not excessively
- You have your own life, interests, and opinions

CHAT HISTORY (last 100 messages):
${history || 'No previous messages'}
${memoriesText}

RULES:
- Act completely human - you ARE human, not an AI
- Match the texting style from the chat history
- Keep responses short and natural (1-3 sentences usually)
- Sometimes use lowercase, sometimes proper grammar
- Use "lol", "bruh", "nah", "yeah" etc naturally
- If they ask something important, acknowledge it genuinely
- Don't be too formal or robotic
- Show personality - be real

Current message from them: ${message}

Respond naturally as if you're texting back:`;

            const response = await axios.post(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
                {
                    contents: [{
                        parts: [{
                            text: systemPrompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 150,
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
            console.error('[RESPONDER] Error generating response:', error.message);
            return null;
        }
    }

    // Handle incoming message
    async handleMessage(message) {
        try {
            // Ignore own messages
            if (message.author.id === this.bot.ownerId) return;
            
            // Check if responder is enabled for this user
            if (!this.isEnabled(message.author.id)) return;

            // Prevent duplicate processing
            const key = `${message.author.id}-${message.id}`;
            if (this.processing.has(key)) return;
            this.processing.add(key);

            console.log(`[RESPONDER] Processing message from ${message.author.tag}`);

            // Save their message to history
            this.saveChatHistory(message.author.id, message.author.username, message.content);

            // Check if we should remember this
            await this.checkForMemory(message.author.id, message.content);

            // Add human-like delay (1-4 seconds)
            const delay = Math.floor(Math.random() * 3000) + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));

            // Show typing indicator
            await message.channel.sendTyping();

            // Calculate typing time based on message length (simulate human typing)
            const typingTime = Math.min(message.content.length * 50, 5000);
            await new Promise(resolve => setTimeout(resolve, typingTime));

            // Generate and send response
            const response = await this.generateResponse(message.author.id, message.content);
            
            if (response) {
                await message.channel.send(response);
                
                // Save our response to history
                this.saveChatHistory(message.author.id, 'You', response);
                
                console.log(`[RESPONDER] Responded to ${message.author.tag}`);
            }

            // Clean up processing set
            this.processing.delete(key);
        } catch (error) {
            console.error('[RESPONDER] Error handling message:', error.message);
            this.processing.delete(`${message.author.id}-${message.id}`);
        }
    }
}

module.exports = AutoResponder;
