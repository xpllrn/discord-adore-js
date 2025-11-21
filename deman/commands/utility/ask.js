const axios = require('axios');

async function getAIResponse(question) {
  const systemPrompt = `You are a person named ren, who code and nice and sweet to everyone and answer all the questions anyone ask him.

RULES:
- Keep responses under as short as possible
- Be direct and concise
- No fluff, no extra explanations
- Just answer what's asked
- If it's a command question, give the exact syntax
- Professional tone, no jokes

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
        temperature: 0.3,
        maxOutputTokens: 100,
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
        if (args.length === 0) return;

        const question = args.join(' ');
        
        try {
            const response = await getAIResponse(question);
            await message.channel.send(response);
        } catch (error) {
            console.error('[ASK] Error:', error.message);
        }
    }
};
