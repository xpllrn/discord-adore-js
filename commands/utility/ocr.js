const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const axios = require('axios');
const FormData = require('form-data');
const { fetch } = require('undici');
const Optiic = require('optiic');

const VISIONPARSER_API_KEY=YOUR_KEY_HERE
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

    let detectedText = null;

    try {
      message.channel.sendTyping();

      // Try VisionParser API first
      try {
        // Download the image
        const imageResponse = await fetch(imageUrl);
        
        if (!imageResponse.ok) {
          throw new Error('Failed to download image');
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        // Create form data
        const formData = new FormData();
        formData.append('file', imageBuffer, {
          filename: 'image.png',
          contentType: 'image/png'
        });
        formData.append('response_type', 'simple');

        // Send to VisionParser API
        const response = await axios.post('https://api.visionparser.com/parse/image/file', formData, {
          headers: {
            ...formData.getHeaders(),
            'api_key': VISIONPARSER_API_KEY=YOUR_KEY_HERE
          },
          timeout: 10000
        });

        if (response.data && response.data.text && response.data.text.trim().length > 0) {
          detectedText = response.data.text;
        }
      } catch (visionError) {
        console.log('VisionParser failed, trying Optiic fallback:', visionError.message);
        
        // Fallback to Optiic API
        try {
          const result = await optiic.process({ url: imageUrl });
          if (result && result.text && result.text.trim().length > 0) {
            detectedText = result.text;
          }
        } catch (optiicError) {
          console.error('Optiic fallback also failed:', optiicError.message);
          throw new Error('Both OCR services failed to process the image');
        }
      }

      // Check if text was detected
      if (!detectedText || detectedText.trim().length === 0) {
        return embeds.warn(message, 'No text detected in the image.');
      }

      // Reply with just the text (no embed)
      return message.reply(detectedText.length > 2000 ? detectedText.substring(0, 1997) + '...' : detectedText);

    } catch (error) {
      console.error('OCR Error:', error);
      return embeds.deny(message, `An error occurred: ${error.message}`);
    }
  }
};
