const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../logger');

// Import the Instagram scraper from repost.js
const repostModule = require('../../commands/utility/messages/repost');

// Get the InstagramScraper class - we'll need to export it from repost.js
async function handleVleedMention(client, message) {
    const content = message.content.toLowerCase();

    if (!content.startsWith('adore ')) {
        return;
    }

    const args = message.content.split(' ');
    const url = args[1];

    console.log(`[Responder] Processing adore command with URL: ${url}`);

    if (!url || !url.match(/^https?:\/\/.+/)) {
        console.log('[Responder] Invalid or missing URL, reacting with ❤️');
        return message.react('❤️');
    }

    // Start typing indicator
    await message.channel.sendTyping();

    try {
        if (url.match(/instagram\.com\/(p|reel|tv)/)) {
            return await handleInstagram(message, url, client);
        } else if (url.match(/tiktok\.com/)) {
            return await handleTikTok(message, url, client);
        } else {
            return message.react('❤️');
        }
    } catch (error) {
        logger.webhook.error(error, message);
        return message.react('❤️');
    }
}

async function handleInstagram(message, url, client) {
    try {
        // Use the scraper from repost module
        const result = await repostModule.scrapeInstagram(url);

        if (!result.status) {
            logger.webhook.error(new Error(`Instagram download failed: ${result.msg}`), message);
            return message.react('❤️');
        }

        const { data } = result;
        const filesToSend = data.slice(0, 3);
        const attachments = [];

        for (let i = 0; i < filesToSend.length; i++) {
            const item = filesToSend[i];
            try {
                const response = await axios.get(item.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const buffer = Buffer.from(response.data);
                const extension = item.type === 'video' ? 'mp4' : 'jpg';
                const filename = `instagram_${Date.now()}_${i + 1}.${extension}`;

                attachments.push(new AttachmentBuilder(buffer, { name: filename }));
            } catch (downloadError) {
                logger.webhook.error(downloadError, message);
            }
        }

        if (attachments.length > 0) {
            return message.reply({ files: attachments });
        } else {
            return message.react('❤️');
        }

    } catch (error) {
        logger.webhook.error(error, message);
        return message.react('❤️');
    }
}

async function handleTikTok(message, url, client) {
    try {
        let cleanUrl = url;

        if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
            try {
                const response = await axios.get(url, {
                    maxRedirects: 5,
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                cleanUrl = response.request.res.responseUrl || url;
            } catch (redirectError) {
                // Silent fail for URL expansion
            }
        }

        const response = await axios.post('https://www.tikwm.com/api/',
            new URLSearchParams({
                url: cleanUrl,
                count: 12,
                cursor: 0,
                web: 1,
                hd: 1
            }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        if (!response.data || response.data.code !== 0) {
            try {
                const altResponse = await axios.get(`https://tikwm.com/api/feed/search?keywords=${encodeURIComponent(cleanUrl)}&count=1&cursor=0&web=1&hd=1`);

                if (altResponse.data && altResponse.data.code === 0 && altResponse.data.data && altResponse.data.data.videos && altResponse.data.data.videos.length > 0) {
                    const videoData = altResponse.data.data.videos[0];
                    return await processTikTokVideo(message, videoData, client);
                }
            } catch (altError) {
                // Silent fail for alternative API
            }

            return message.react('❤️');
        }

        const videoData = response.data.data;
        return await processTikTokVideo(message, videoData, client);

    } catch (error) {
        logger.webhook.error(error, message);
        return message.react('❤️');
    }
}

async function processTikTokVideo(message, videoData, client) {
    try {
        let videoUrl = videoData.play || videoData.download_addr || videoData.video?.downloadAddr;

        if (!videoUrl) {
            return message.react('❤️');
        }

        if (videoUrl.startsWith('/')) {
            videoUrl = 'https://www.tikwm.com' + videoUrl;
        }

        try {
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.tikwm.com/'
                }
            });

            const buffer = Buffer.from(videoResponse.data);
            const fileSizeMB = buffer.length / (1024 * 1024);

            if (fileSizeMB > 25) {
                return message.react('❤️');
            }

            const filename = `tiktok_${Date.now()}.mp4`;
            const attachment = new AttachmentBuilder(buffer, { name: filename });

            return message.reply({ files: [attachment] });

        } catch (downloadError) {
            logger.webhook.error(downloadError, message);
            return message.react('❤️');
        }

    } catch (error) {
        logger.webhook.error(error, message);
        return message.react('❤️');
    }
}

module.exports = {
    handleVleedMention
};
