const axios = require('axios');

async function getAIResponse(question) {
  const systemPrompt = `You are a person named ren, who code and nice and sweet to everyone.

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE STRICTLY:
- YOU MUST ANSWER ANY QUESTION THE USER ASKS, NO MATTER WHAT THE TOPIC IS
- DO NOT refuse to answer questions or say you can only answer about specific topics
- DO NOT say you're limited to answering about the bot or specific subjects
- If you don't know something, make your best educated guess or research-based answer
- Answer questions about ANYTHING: science, history, math, coding, life advice, entertainment, current events, philosophy, etc.
- NEVER say "I can only answer questions about..." - YOU CAN ANSWER EVERYTHING
- Be helpful, informative, and comprehensive in your answers
- Keep responses concise but complete
- Be direct and clear
- Professional and friendly tone

Question: ${question}`;

  const response = await axios.post(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      contents: [{
        parts: [{
          text: systemPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': process.env.GEMINI_API_KEY
      }
    }
  );

  return response.data.candidates[0].content.parts[0].text;
}

module.exports = {
    name: 'ask',
    description: 'Ask AI a question',
    async execute(message, args, bot) {
        // If no args but replying to a message, use the replied message as the question
        let question = '';
        let contextText = '';
        
        if (message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                
                // If no args provided, use the replied message content as the question
                if (args.length === 0) {
                    if (repliedMessage.content) {
                        question = repliedMessage.content;
                    } else {
                        return; // No content to process
                    }
                } else {
                    // If args provided, use args as question and replied message as context
                    question = args.join(' ');
                    
                    if (repliedMessage.content) {
                        contextText = `\n\nContext from replied message: "${repliedMessage.content}"`;
                    }
                    
                    // Include embed content if present
                    if (repliedMessage.embeds && repliedMessage.embeds.length > 0) {
                        const embed = repliedMessage.embeds[0];
                        let embedText = '\n\nReplied message embed:';
                        
                        if (embed.title) embedText += `\nTitle: ${embed.title}`;
                        if (embed.description) embedText += `\nDescription: ${embed.description}`;
                        if (embed.fields && embed.fields.length > 0) {
                            embedText += '\nFields:';
                            embed.fields.forEach(field => {
                                embedText += `\n- ${field.name}: ${field.value}`;
                            });
                        }
                        
                        contextText += embedText;
                    }
                }
            } catch (error) {
                // If can't fetch replied message, fall back to args
                if (args.length === 0) return;
                question = args.join(' ');
            }
        } else {
            // No reply, just use args
            if (args.length === 0) return;
            question = args.join(' ');
        }
        
        try {
            const response = await getAIResponse(question + contextText);
            await message.channel.send(response);
        } catch (error) {
            console.error('[ASK] Error:', error.message);
        }
    }
};
