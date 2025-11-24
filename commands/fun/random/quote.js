const sharp = require('sharp');
const { AttachmentBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../../../utils/logger');

module.exports = {
  name: "quote",
  aliases: ['q'],
  description: "Quote a message by replying, message ID, or mentioning a user",
  syntax: 'quote [message_id|@user text]',
  example: 'quote @vwsn hello world',
  permission: "attach_files",
  run: async (client, message, args) => {
    try {
      let targetUser = null;
      let quoteText = null;
      let referencedMessage = null;

      // Check if replying to a message
      if (message.reference) {
        try {
          referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
          targetUser = referencedMessage.author;
          quoteText = referencedMessage.content;
        } catch (error) {
          return embeds.deny(message, 'Could not fetch the **referenced message**.');
        }
      }
      // Check if message ID provided
      else if (args[0] && /^\d{17,19}$/.test(args[0])) {
        try {
          referencedMessage = await message.channel.messages.fetch(args[0]);
          targetUser = referencedMessage.author;
          quoteText = referencedMessage.content;
        } catch (error) {
          return embeds.deny(message, 'Could not find a message with that **ID**.');
        }
      }
      // Check if user mention provided
      else if (message.mentions.users.size > 0) {
        targetUser = message.mentions.users.first();
        quoteText = args.slice(1).join(' ');

        if (!quoteText) {
          return embeds.warn(message, 'Please provide **text to quote** after mentioning the user.');
        }
      }
      // No valid input
      else {
        return embeds.warn(message, 'Please **reply to a message**, provide a **message ID**, or **mention a user** with text to quote.');
      }

      // Validate quote text
      if (!quoteText || quoteText.trim().length === 0) {
        return embeds.deny(message, 'The message has **no text content** to quote.');
      }

      if (quoteText.length > 500) {
        quoteText = quoteText.substring(0, 497) + '...';
      }

      // Create the quote image
      const buffer = await createQuoteImage(targetUser, quoteText);

      const attachment = new AttachmentBuilder(buffer, {
        name: `quote-${targetUser.username}.png`
      });

      await message.channel.send({ files: [attachment] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while generating the quote image.');
    }
  }
};

async function createQuoteImage(user, text) {
  const width = 1000;
  const height = 400;

  try {

    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatarBuffer = await downloadImage(avatarUrl);


    const tempAvatarPath = path.join(__dirname, 'temp_pfp.png');
    fs.writeFileSync(tempAvatarPath, avatarBuffer);


    // Create fade gradient that only covers the avatar area (400px width)
    const fade = Buffer.from(`<svg width="400" height="${height}">
      <defs>
        <linearGradient id="smoothFade" x1="0" x2="1">
          <stop offset="0%" stop-color="rgba(0,0,0,0)" />
          <stop offset="40%" stop-color="rgba(0,0,0,0)" />
          <stop offset="70%" stop-color="rgba(0,0,0,0.4)" />
          <stop offset="90%" stop-color="rgba(0,0,0,0.8)" />
          <stop offset="100%" stop-color="rgba(0,0,0,1)" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#smoothFade)"/>
    </svg>`);

    // Process text for proper wrapping and truncation (reduced width for margins)
    const processedText = processTextForWrapping(text, 35); // Max 35 chars per line (10% margin on each side)

    // Create text SVG with proper wrapping and positioning
    const textSvg = Buffer.from(`<svg width="1000" height="400">
      ${generateWrappedText(processedText, 700, 160, 31, 35)}
      <text x="700" y="${160 + (processedText.lines.length * 35) + 15}" font-family="Arial, sans-serif" font-size="16" font-weight="300" fill="#aaaaaa" text-anchor="middle">- ${escapeXml(user.username)}</text>
    </svg>`);

    // Process the image
    const resizedBuffer = await sharp(tempAvatarPath)
      .resize(400, 400)
      .blur(1.5)
      .png()
      .toBuffer();

    const extendedBuffer = await sharp(resizedBuffer)
      .extend({
        right: 600,
        background: { r: 0, g: 0, b: 0 }
      })
      .png()
      .toBuffer();

    const gradientCompositeBuffer = await sharp(extendedBuffer)
      .composite([{
        input: fade,
        top: 0,
        left: 0,
        blend: 'over'
      }])
      .png()
      .toBuffer();

    const outputBuffer = await sharp(gradientCompositeBuffer)
      .composite([
        {
          input: textSvg,
          top: 0,
          left: 0
        }
      ])
      .png()
      .toBuffer();

    // Clean up temporary file
    if (fs.existsSync(tempAvatarPath)) {
      fs.unlinkSync(tempAvatarPath);
    }

    return outputBuffer;

  } catch (error) {
    logger.webhook.error(error, message);

    // Fallback: create a simple text-only image
    const fallbackSvg = Buffer.from(`
      <svg width="1000" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="black"/>
        <text x="500" y="180" font-size="36" fill="white" text-anchor="middle">${escapeXml(text)}</text>
        <text x="500" y="230" font-size="24" fill="#aaa" text-anchor="middle">- ${escapeXml(user.username)}</text>
      </svg>
    `);

    return await sharp(fallbackSvg).png().toBuffer();
  }
}

// Helper function to download images
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Helper function to escape XML characters
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper function to process text for wrapping
function processTextForWrapping(text, maxCharsPerLine) {
  const maxLines = 4;
  const maxTotalChars = maxCharsPerLine * maxLines - 3; // Reserve space for "..."

  // Truncate if too long
  if (text.length > maxTotalChars) {
    text = text.substring(0, maxTotalChars) + '...';
  }

  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Single word is too long, truncate it
        lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
        currentLine = '';
      }

      // Stop if we've reached max lines
      if (lines.length >= maxLines) {
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return { lines, totalLines: lines.length };
}

// Helper function to generate SVG text elements for wrapped text
function generateWrappedText(processedText, x, startY, fontSize, lineHeight) {
  return processedText.lines.map((line, index) => {
    const y = startY + (index * lineHeight);
    return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="400" fill="white" text-anchor="middle">${escapeXml(line)}</text>`;
  }).join('\n      ');
}

