const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { fetch } = require('undici');

const GOOGLE_API_KEY=YOUR_KEY_HERE

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

      // Download the image and convert to base64
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        return embeds.warn(message, 'Failed to download the image. Please make sure the URL is valid and accessible.');
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      // Prepare the request to Google Cloud Vision API
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1
              }
            ]
          }
        ]
      };

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY=YOUR_KEY_HERE
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Vision API Error:', response.status, errorText);
        const errorData = JSON.parse(errorText).catch(() => ({}));
        return embeds.warn(message, `API Error (${response.status}): ${errorData.error?.message || 'Failed to process the image'}`);
      }

      const data = await response.json();

      // Check for errors
      if (data.responses[0].error) {
        return embeds.warn(message, `OCR Error: ${data.responses[0].error.message}`);
      }

      // Extract text
      const textAnnotations = data.responses[0].textAnnotations;
      
      if (!textAnnotations || textAnnotations.length === 0) {
        return embeds.warn(message, 'No text detected in the image.');
      }

      const detectedText = textAnnotations[0].description;

      // Create embed with results
      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.member.displayAvatarURL({ dynamic: true })
        })
        .setTitle('📝 OCR Results')
        .setDescription(detectedText.length > 4000 ? detectedText.substring(0, 4000) + '...' : detectedText)
        .setThumbnail(imageUrl)
        .setFooter({ text: `Detected ${textAnnotations.length - 1} text blocks` });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('OCR Error:', error);
      return embeds.deny(message, `An error occurred: ${error.message}`);
    }
  }
};
