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

    try {
      message.channel.sendTyping();

      console.log('[OCR] Processing image:', imageUrl);

      // Download the image once
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        console.error('[OCR] Failed to download image:', imageResponse.status);
        return embeds.warn(message, 'Failed to download the image. Please make sure the URL is valid and accessible.');
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      console.log('[OCR] Image downloaded, size:', imageBuffer.length, 'bytes');

      // Run both APIs in parallel
      const visionParserPromise = (async () => {
        try {
          console.log('[OCR] Starting VisionParser API call...');
          const formData = new FormData();
          formData.append('file', imageBuffer, {
            filename: 'image.png',
            contentType: 'image/png'
          });
          formData.append('response_type', 'simple');

          const response = await axios.post('https://api.visionparser.com/parse/image/file', formData, {
            headers: {
              ...formData.getHeaders(),
              'api_key': VISIONPARSER_API_KEY=YOUR_KEY_HERE
            },
            timeout: 15000
          });

          console.log('[OCR] VisionParser response status:', response.status);
          console.log('[OCR] VisionParser response data:', JSON.stringify(response.data, null, 2));

          if (response.data && response.data.text && response.data.text.trim().length > 0) {
            console.log('[OCR] VisionParser SUCCESS - Text length:', response.data.text.length);
            return { source: 'VisionParser', text: response.data.text };
          } else {
            console.log('[OCR] VisionParser returned empty or no text');
            return null;
          }
        } catch (error) {
          console.error('[OCR] VisionParser ERROR:', error.message);
          if (error.response) {
            console.error('[OCR] VisionParser error response:', JSON.stringify(error.response.data, null, 2));
          }
          return null;
        }
      })();

      const optiicPromise = (async () => {
        try {
          console.log('[OCR] Starting Optiic API call...');
          const result = await optiic.process({ url: imageUrl });
          
          console.log('[OCR] Optiic response:', JSON.stringify(result, null, 2));

          if (result && result.text && result.text.trim().length > 0) {
            console.log('[OCR] Optiic SUCCESS - Text length:', result.text.length);
            return { source: 'Optiic', text: result.text };
          } else {
            console.log('[OCR] Optiic returned empty or no text');
            return null;
          }
        } catch (error) {
          console.error('[OCR] Optiic ERROR:', error.message);
          return null;
        }
      })();

      // Wait for both to complete
      const results = await Promise.all([visionParserPromise, optiicPromise]);
      console.log('[OCR] Both APIs completed');

      // Use VisionParser result if available, otherwise Optiic
      const result = results[0] || results[1];

      if (!result || !result.text) {
        console.log('[OCR] No text detected by either API');
        return embeds.warn(message, 'No text detected in the image by either OCR service.');
      }

      console.log('[OCR] Using result from:', result.source);
      console.log('[OCR] Final text:', result.text.substring(0, 100) + '...');

      // Reply with just the text (no embed)
      return message.reply(result.text.length > 2000 ? result.text.substring(0, 1997) + '...' : result.text);

    } catch (error) {
      console.error('[OCR] Fatal error:', error);
      return embeds.deny(message, `An error occurred: ${error.message}`);
    }
  }
};
