const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../../config/setup');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const https = require('https');

module.exports = {
    name: "screenshot",
    aliases: ['ss', 'screen', 'snap'],
    description: "Take a screenshot of a website",
    syntax: 'screenshot (url)',
    example: 'screenshot https://google.com',
    run: async (client, message, args) => {
        if (!args[0]) {
            return runHelpCommand(message, 'screenshot');
        }

        let url = args[0];

        // Add https:// if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch (e) {
            return embeds.warn(message, 'Please provide a valid URL');
        }

        // Show typing indicator
        await message.channel.sendTyping();

        // Start timer
        const startTime = Date.now();

        try {
            // Using apiflash API
            const apiUrl = "https://api.apiflash.com/v1/urltoimage?" + new URLSearchParams({
                access_key: "46e12e9b1db046648289b8827151f611",
                wait_until: "page_loaded",
                url: url
            }).toString();

            // Download the screenshot
            const chunks = [];

            await new Promise((resolve, reject) => {
                https.get(apiUrl, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`API returned status code ${response.statusCode}`));
                        return;
                    }

                    response.on('data', (chunk) => chunks.push(chunk));
                    response.on('end', () => resolve());
                    response.on('error', reject);
                }).on('error', reject);
            });

            const buffer = Buffer.concat(chunks);
            const attachment = new AttachmentBuilder(buffer, { name: 'screenshot.jpeg' });

            // Calculate time taken
            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);

            const embed = new EmbedBuilder()
                .setColor(colors.embed)
                .setAuthor({
                    name: message.author.displayName,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setImage('attachment://screenshot.jpeg')
                .setFooter({
                    text: `⏱️ It took ${timeTaken} seconds`
                });

            await message.reply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error(error);
            return embeds.deny(message, 'Failed to take screenshot. The website might be unreachable or blocking requests.');
        }
    }
};
