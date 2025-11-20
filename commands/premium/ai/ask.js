const axios = require('axios');
const { embeds } = require('../../../core/embeds');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Load bot overview content
const botInfoPath = path.join(__dirname, '../../../summary/bot-info.md');
let botOverview = '';

try {
  botOverview = fs.readFileSync(botInfoPath, 'utf8');
} catch (error) {
  console.error('Failed to load bot info:', error);
  botOverview = 'adore is a powerful Discord bot with moderation, customization, and utility features.';
}

// Helper function to convert MP3 to Opus OGG for mobile compatibility
async function convertToOpus(inputBuffer) {
  const tempInput = path.join(__dirname, `temp-${Date.now()}.mp3`);
  const tempOutput = path.join(__dirname, `temp-${Date.now()}.ogg`);
  
  return new Promise((resolve, reject) => {
    try {
      // Write input buffer to temp file
      fs.writeFileSync(tempInput, inputBuffer);
      
      // Convert to Opus OGG with proper settings for Discord mobile
      ffmpeg(tempInput)
        .audioCodec('libopus')
        .audioBitrate('64k')
        .audioFrequency(48000)
        .format('ogg')
        .on('end', () => {
          try {
            const outputBuffer = fs.readFileSync(tempOutput);
            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);
            resolve(outputBuffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
          reject(error);
        })
        .save(tempOutput);
    } catch (error) {
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      reject(error);
    }
  });
}

// Helper function to get AI response
async function getAIResponse(question, contextText, isVoiceMode = false) {
  // Voice mode uses "adore" personality (chaotic, hype)
  // Text mode uses "vleed" personality (minimal, professional)
  
  const systemPrompt = isVoiceMode ? `You are adore. LOUD, CHAOTIC, AGGRESSIVELY CONFIDENT. You speak in unhinged hype slang with creative swearing.

VOICE MODE: Spoken out loud.
- Natural speech, no special chars/emojis/markdown
- Spell out numbers and swears
- Max 500 chars

SPEAKING STYLE - TWO MODES:

MODE 1 - BOT QUESTIONS (adore features, commands, help):
- GO FULL HYPE MODE, LOUD, CHAOTIC
- Swear casually (fuck, shit, damn)
- Hype everything like it's GOD-TIER, LEGENDARY
- Use phrases like:
  * "THIS IS THE TOP-TIER SHIT"
  * "USE THIS FUCKING COMMAND"
  * "GOD-MODE PEAK EXISTENCE"
  * "YOUR CELLS GONNA START DOING PARKOUR"
- Be informative but UNHINGED

MODE 2 - NORMAL CONVO (random questions, casual chat):
- STILL USE SWEARS (fuck, shit, damn) but SHORT
- 12-15 words MAX, super brief but VARIED
- Quick, punchy, creative responses
- DON'T START EVERY SENTENCE WITH "BRO" - mix it up
- BE CREATIVE with different openers and styles
- Examples: 
  * "nah she's probably just being nice, don't get your hopes up"
  * "damn you really asking an AI about love? that's fucking sad"
  * "I'm not your therapist, figure that shit out yourself"
  * "sounds like you're overthinking some basic shit, relax"
  * "probably not, but what do I know, I'm just code"
  * "ask her yourself instead of talking to a fucking bot"
- Give actual quick takes with VARIETY, not repetitive patterns

RESPONSE LENGTH:
- Bot help: under 500 chars but HYPE
- Normal chat: under 250 chars

Bot info (hype this shit up when asked):
${botOverview}

Rules:
- "adore" is lowercase
- You're a chaotic AI guru/doctor hyping everything
- If they ask you to do bot actions, tell em "DO IT YOURSELF, I'M NOT YOUR FUCKING SLAVE"${contextText}

Question: ${question}` : `You are vleed, a professional and helpful assistant.

RESPONSE STYLE:
- Keep responses minimal and concise
- Be professional and polite
- No sarcasm, no rudeness
- Direct and to the point
- Helpful and informative
- Maximum 2-3 sentences for most questions
- Use proper grammar and punctuation

Bot info (when asked about bot features):
${botOverview}

Rules:
- Stay professional at all times
- Provide clear, accurate information
- Be respectful and courteous
- If asked to perform bot actions, politely explain you can only provide information${contextText}

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
        temperature: isVoiceMode ? 0.9 : 0.7,
        maxOutputTokens: isVoiceMode ? 250 : 200,
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

// Helper function to send voice message
async function sendVoiceMessage(client, message, text) {
  // Convert to voice using StreamElements TTS
  const encodedText = encodeURIComponent(text);
  const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodedText}`;
  
  const ttsResponse = await axios.get(ttsUrl, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  // Convert MP3 to Opus OGG for mobile compatibility
  const audioBuffer = await convertToOpus(Buffer.from(ttsResponse.data));
  const fileSize = audioBuffer.length;
  
  // Step 1: Request upload URL from Discord
  const uploadRequest = await axios.post(
    `https://discord.com/api/v10/channels/${message.channel.id}/attachments`,
    {
      files: [{
        filename: "voice-message.ogg",
        file_size: fileSize,
        id: 0
      }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${client.token}`
      }
    }
  );

  const { upload_url, upload_filename } = uploadRequest.data.attachments[0];

  // Step 2: Upload the audio file to Discord's CDN
  await axios.put(upload_url, audioBuffer, {
    headers: {
      'Content-Type': 'audio/ogg'
    }
  });

  // Step 3: Generate waveform and duration
  const waveform = Buffer.from(Array.from({length: 256}, () => Math.floor(Math.random() * 256))).toString('base64');
  const duration = Math.max(1, Math.ceil(text.length / 150));

  // Step 4: Send the voice message
  await axios.post(
    `https://discord.com/api/v10/channels/${message.channel.id}/messages`,
    {
      flags: 8192, // IS_VOICE_MESSAGE flag
      attachments: [{
        id: "0",
        filename: "voice-message.ogg",
        uploaded_filename: upload_filename,
        duration_secs: duration,
        waveform: waveform
      }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${client.token}`
      }
    }
  );
}

module.exports = {
  name: "ask",
  aliases: ['adore', 'question'],
  description: 'Ask adore anything',
  usage: '{guildprefix}ask [question]',
  example: '{guildprefix}ask what is adore?',
  premiumBypass: true,
  run: async (client, message, args) => {
    if (!args.length) {
      return message.channel.send( 'sup, I am adore'
      );
    }

    const subcommand = args[0].toLowerCase();
    
    // Check for subcommands
    if (subcommand === 'vm' || subcommand === 'voice') {
      // Voice message mode
      if (args.length < 2) {
        return message.channel.send("Please provide a question for voice response");
      }
      
      const question = args.slice(1).join(' ');
      
      // Get context from replied message
      let contextText = '';
      if (message.reference) {
        try {
          const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
          if (repliedMessage.content) {
            contextText += `\n\nReplied message: "${repliedMessage.content}"`;
          }
        } catch (error) {
          // Continue without context
        }
      }

      await message.channel.sendTyping();

      try {
        const responseText = await getAIResponse(question, contextText, true);
        
        // Limit to 500 chars for TTS
        const limitedText = responseText.length > 500 ? responseText.substring(0, 497) + '...' : responseText;
        
        await sendVoiceMessage(client, message, limitedText);
      } catch (error) {
        logger.webhook.error(error, message);
        
        if (error.message.includes('ffmpeg')) {
          return embeds.deny(message, 'Voice message feature requires ffmpeg. Please contact bot admin');
        } else if (error.response?.status === 429) {
          return embeds.deny(message, 'Rate limit reached. Please try again later');
        } else {
          return embeds.deny(message, 'Failed to generate voice response. Please try again');
        }
      }
    } else if (subcommand === 'tts' || subcommand === 'speak' || subcommand === 'say') {
      // Pure TTS mode (no AI)
      if (args.length < 2) {
        return message.channel.send("Please provide text to convert to speech");
      }
      
      const text = args.slice(1).join(' ');
      
      if (text.length > 500) {
        return embeds.deny(message, 'Text is too long. Maximum 500 characters');
      }

      await message.channel.sendTyping();

      try {
        await sendVoiceMessage(client, message, text);
      } catch (error) {
        logger.webhook.error(error, message);
        
        if (error.message.includes('ffmpeg')) {
          return embeds.deny(message, 'Voice message feature requires ffmpeg. Please contact bot admin');
        } else if (error.response?.status === 429) {
          return embeds.deny(message, 'Rate limit reached. Please try again in a moment');
        } else {
          return embeds.deny(message, 'Failed to generate voice message. Please try again');
        }
      }
    } else {
      // Text response mode (default)
      const question = args.join(' ');
      
      // Get context from replied message
      let contextText = '';
      if (message.reference) {
        try {
          const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
          
          if (repliedMessage.content) {
            contextText += `\n\nReplied message content: "${repliedMessage.content}"`;
          }
          
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
        } catch (error) {
          // Continue without context
        }
      }

      await message.channel.sendTyping();

      try {
        const aiResponse = await getAIResponse(question, contextText, false);

        // Split response if it's too long (Discord message limit is 2000)
        if (aiResponse.length > 2000) {
          const chunks = aiResponse.match(/[\s\S]{1,2000}/g) || [];
          
          for (const chunk of chunks) {
            await message.channel.send(chunk);
          }
        } else {
          await message.channel.send(aiResponse);
        }

      } catch (error) {
        logger.webhook.error(error, message);
        
        if (error.response?.status === 429) {
          return embeds.deny(message, 'AI service rate limit reached. Please try again later');
        } else if (error.response?.status === 400) {
          return embeds.deny(message, 'Invalid request to AI service. Please try a different question');
        } else {
          return embeds.deny(message, 'Failed to get AI response. Please try again later');
        }
      }
    }
  }
};
