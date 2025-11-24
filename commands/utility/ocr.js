const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const logger = require('../../utils/logger');
const Optiic = require('optiic');

const OPTIIC_API_KEY=YOUR_KEY_HERE

const optiic = new Optiic({
  apiKey: 'YOUR_API_KEY'
});

module.exports = {
  name: "ocr",
  aliases: ['textrecognition', 'readtext'],
  description: 'Extract text from images using OCR (Optical Character Recognition)',
  syntax: 'ocr {attach image} or ocr {image url}',
  example: 'ocr https://example.com/image.png',
  run: async(client, message, args) => {
    
    let imageUrl = null;

    // Check for image attachment
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      // Check if it's an image by contentType or file extension
      const isImage = (attachment.contentType && attachment.contentType.startsWith('image/')) ||
                      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(attachment.name);
      if (isImage) {
        imageUrl = attachment.url;
      }
    }

    // Check for image URL in args
    if (!imageUrl && args[0]) {
      const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp)/i;
      if (urlPattern.test(args[0]) || args[0].startsWith('http')) {
        imageUrl = args[0];
      }
    }

    // Check for replied message with image
    if (!imageUrl && message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage.attachments.size > 0) {
          const attachment = repliedMessage.attachments.first();
          if (attachment.contentType && attachment.contentType.startsWith('image/')) {
            imageUrl = attachment.url;
          }
        }
      } catch (error) {
        // Ignore if can't fetch replied message
      }
    }

    if (!imageUrl) {
      return runHelpCommand(message, 'ocr');
    }

    try {
      message.channel.sendTyping();

      // Process with Optiic
      const result = await optiic.process({ url: imageUrl });

      if (!result || !result.text || result.text.trim().length === 0) {
        return embeds.warn(message, 'No text detected in the image.');
      }

      // Reply with just the text (no embed)
      return message.reply(result.text.length > 2000 ? result.text.substring(0, 1997) + '...' : result.text);

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while processing the image');
    }
  }
};
