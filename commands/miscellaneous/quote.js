const { createCanvas, loadImage, registerFont } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');

module.exports = {
  name: "quote",
  aliases: ['q'],
  description: "Generate an aesthetic quote image with user's profile picture and message",
  usage: `{guildprefix}quote [user mention or message ID]`,
  permission: "Send Messages",
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
          return embeds.deny(message, 'Could not fetch the referenced message.');
        }
      }
      // Check if message ID provided
      else if (args[0] && /^\d{17,19}$/.test(args[0])) {
        try {
          referencedMessage = await message.channel.messages.fetch(args[0]);
          targetUser = referencedMessage.author;
          quoteText = referencedMessage.content;
        } catch (error) {
          return embeds.deny(message, 'Could not find a message with that ID.');
        }
      }
      // Check if user mention provided
      else if (message.mentions.users.size > 0) {
        targetUser = message.mentions.users.first();
        quoteText = args.slice(1).join(' ');
        
        if (!quoteText) {
          return embeds.warn(message, 'Please provide text to quote after mentioning the user.');
        }
      }
      // No valid input
      else {
        return embeds.warn(message, 'Please reply to a message, provide a message ID, or mention a user with text to quote.');
      }

      // Validate quote text
      if (!quoteText || quoteText.trim().length === 0) {
        return embeds.deny(message, 'The message has no text content to quote.');
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
      console.error('Quote command error:', error);
      return embeds.deny(message, 'An error occurred while generating the quote image.');
    }
  }
};

async function createQuoteImage(user, text) {
  const width = 1200;
  const height = 630;
  
  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fill entire background with pure black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Calculate sections: 50% for PFP, 50% for text (but curve will cover 10% of PFP)
  const pfpSection = width * 0.5;  // 600px - PFP takes full 50%
  const textSection = width * 0.5; // 600px - Text area

  // Load and draw profile picture (rectangular, not circular)
  try {
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatar = await loadImage(avatarUrl);
    
    // Profile picture fills the full left 50% section
    const pfpWidth = pfpSection;
    const pfpHeight = height;
    const pfpX = 0;
    const pfpY = 0;

    // Draw profile picture as rectangle (no clipping)
    ctx.drawImage(avatar, pfpX, pfpY, pfpWidth, pfpHeight);

  } catch (error) {
    console.error('Error loading avatar:', error);
    // Draw placeholder rectangle if avatar fails to load
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, pfpSection, height);
    
    // Add user initial
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(user.username[0].toUpperCase(), pfpSection / 2, height / 2);
  }

  // Draw curvy gradient overlay - covers part of PFP with 100% dark gradient
  const curveStartX = pfpSection * 0.8; // Start at 80% of PFP section (covers 20% of PFP)
  const curveEndX = width; // Extend to end of canvas
  
  // Create 100% dark gradient for shadow effect
  const darkGradient = ctx.createLinearGradient(curveStartX, 0, curveStartX + 120, 0);
  darkGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');     // Transparent (shows PFP)
  darkGradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.8)'); // Dark shadow
  darkGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.95)'); // Very dark
  darkGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');     // 100% black
  
  // Draw smooth curvy gradient shape
  ctx.beginPath();
  ctx.moveTo(curveStartX, 0);
  // Smooth S-curve
  ctx.bezierCurveTo(
    curveStartX + 40, height * 0.2,   // Control point 1
    curveStartX + 80, height * 0.8,   // Control point 2
    curveStartX + 30, height          // End point
  );
  ctx.lineTo(curveEndX, height);
  ctx.lineTo(curveEndX, 0);
  ctx.closePath();
  ctx.fillStyle = darkGradient; // 100% dark gradient
  ctx.fill();

  // Text area in right section (starts after PFP section)
  const textSectionStart = pfpSection;
  const textSectionWidth = width - textSectionStart;
  const textCenterX = textSectionStart + (textSectionWidth / 2);

  // Set up text styling
  ctx.fillStyle = '#ffffff';
  ctx.font = '60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Word wrap the quote text for center alignment
  const lines = wrapTextCenter(ctx, text, textSectionWidth - 60, 60); // 30px padding each side
  
  // Calculate vertical centering for text block
  const lineHeight = 70;
  const totalTextHeight = (lines.length * lineHeight) + 50; // Include space for username
  const textStartY = (height - totalTextHeight) / 2;
  
  // Draw quote text centered
  lines.forEach((line, index) => {
    ctx.fillText(line, textCenterX, textStartY + (index * lineHeight));
  });

  // Draw username - smaller, italic, lighter gray, centered
  const usernameY = textStartY + (lines.length * lineHeight) + 30;
  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'italic 28px Arial, sans-serif';
  ctx.fillText(`— ${user.username}`, textCenterX, usernameY);

  return canvas.toBuffer('image/png');
}

// Removed drawCurvedDivider function as it's now integrated into createQuoteImage

function wrapTextCenter(ctx, text, maxWidth, fontSize) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && i > 0) {
      lines.push(currentLine.trim());
      currentLine = words[i] + ' ';
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  // Limit to 4 lines to prevent overflow
  return lines.slice(0, 4);
}