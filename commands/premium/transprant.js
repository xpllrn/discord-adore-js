const fs = require("node:fs");
const path = require("node:path");
const { embeds } = require('../../core/embeds');
const logger = require('../../utils/logger');
const axios = require('axios');

async function removeBg(blob) {
    const formData = new FormData();
    formData.append("size", "auto");
    formData.append("image_file", blob);

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": process.env.BGREMOVER },
        body: formData,
    });

    if (response.ok) {
        return await response.arrayBuffer();
    } else {
        throw new Error(`${response.status}: ${response.statusText}`);
    }
}

module.exports = {
    name: "transprant",
    aliases: ['tp'],
    description: 'Remove background from an image to make it transparent',
    usage: '{guildprefix}transprant [attach image or reply to message with image]',
    example: '{guildprefix}transprant',
    premiumBypass: false,
    run: async (client, message, args) => {
        let imageUrl = null;

        // Check for image attachment
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment.contentType?.startsWith('image/')) {
                imageUrl = attachment.url;
            }
        }

        // Check for replied message with image
        if (!imageUrl && message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.attachments.size > 0) {
                    const attachment = repliedMessage.attachments.first();
                    if (attachment.contentType?.startsWith('image/')) {
                        imageUrl = attachment.url;
                    }
                }
            } catch (error) {
                // Continue without context
            }
        }

        // No image found
        if (!imageUrl) {
            return embeds.deny(message, 'Please attach an image or reply to a message with an image to remove its background');
        }

        await message.channel.sendTyping();

        try {
            // Download the image
            const imageResponse = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });

            // Convert to blob
            const imageBuffer = Buffer.from(imageResponse.data);
            const blob = new Blob([imageBuffer], { type: 'image/png' });

            // Remove background
            const rbgResultData = await removeBg(blob);

            // Save to temporary file
            const tempOutputPath = path.join(__dirname, `no-bg-${Date.now()}.png`);
            fs.writeFileSync(tempOutputPath, Buffer.from(rbgResultData));

            // Send the result
            await message.channel.send({
                files: [{
                    attachment: tempOutputPath,
                    name: 'no-bg.png'
                }]
            });

            // Clean up temporary file
            fs.unlinkSync(tempOutputPath);

        } catch (error) {
            logger.webhook.error(error, message);

            if (error.response?.status === 429) {
                return embeds.deny(message, 'Rate limit reached. Please try again later');
            } else if (error.response?.status === 403) {
                return embeds.deny(message, 'Invalid API key. Please contact bot admin');
            } else if (error.response?.status === 400) {
                return embeds.deny(message, 'Invalid image format. Please try a different image');
            } else {
                return embeds.deny(message, 'Failed to remove background. Please try again later');
            }
        }
    }
};
