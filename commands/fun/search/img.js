const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { colors, emojis } = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');

module.exports = {
  name: "img",
  aliases: ['image', 'search'],
  description: `Search for images using Google Custom Search`,
  syntax: 'img [query]',
  example: 'img cats',
  cooldown: 3000,
  run: async (client, message, args) => {
    await ensureGuildData(message.guild.id);

    const query = args.join(' ');
    if (!query) {
      return runHelpCommand(message, 'img');
    }

    if (!process.env.GOOGLE_IMG) {
      return embeds.warn(message, 'Please check your **Google Custom Search** API');
    }

    if (!process.env.GOOGLE_SEARCH_ENGINE_ID) {
      return embeds.warn(message, 'Please check your Google Custom Search **Engine ID**');
    }

    // Send loading message
    const loadingMessage = await embeds.loading(message, `Searching for images: **${query}**...`);

    try {
      // Make API request to Google Custom Search
      const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_IMG}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=active`);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Delete loading message
      try {
        await loadingMessage.delete();
      } catch (error) {
        // Ignore deletion errors
      }

      // Check if we got results
      if (!data.items || data.items.length === 0) {
        return embeds.warn(message, `No images found for: **${query}**`);
      }

      // Format results for pagination
      const images = data.items.map((item, index) => ({
        title: item.title || 'Untitled',
        url: item.link,
        thumbnail: item.image?.thumbnailLink || item.link,
        contextLink: item.image?.contextLink || '',
        displayLink: item.displayLink || '',
        index: index + 1
      }));

      // Create pagination function
      const formatPage = (pageImages, currentPage, totalPages) => {
        const image = pageImages[0]; // One image per page

        const embed = new EmbedBuilder()
          .setColor(colors.info)
          .setDescription(`${emojis.google} **Google Image search**: ${query}`)
          .setImage(image.url)
          .setFooter({
            text: `Page ${currentPage} of ${totalPages} • ${image.displayLink}`,
            iconURL: message.author.displayAvatarURL({ dynamic: true })
          });

        return embed;
      };

      // Create pagination with 1 image per page
      await createPagination(message, images, formatPage, 1, `Image Search: ${query}`);

    } catch (error) {
      // Delete loading message if it still exists
      try {
        await loadingMessage.delete();
      } catch (deleteError) {
        // Ignore deletion errors
      }

      // Handle specific error cases
      if (error.message.includes('403')) {
        return embeds.warn(message, 'Google Custom Search API quota exceeded or invalid API key.');
      } else if (error.message.includes('400')) {
        return embeds.warn(message, 'Invalid search query. Please try a different search term.');
      } else {
        return embeds.warn(message, 'Failed to search for images. Please try again later.');
      }
    }
  }
};
