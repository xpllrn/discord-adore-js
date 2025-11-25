const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { colors, emojis } = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');

// Shared logic for image search
async function imageSearchShared(context, query) {
  const isInteraction = !!context.user;

  if (!process.env.GOOGLE_IMG) {
    return embeds.warn(context, 'Please check your **Google Custom Search** API', false);
  }

  if (!process.env.GOOGLE_SEARCH_ENGINE_ID) {
    return embeds.warn(context, 'Please check your Google Custom Search **Engine ID**', false);
  }

  // Send loading message
  let loadingMessage;
  if (isInteraction) {
    await context.deferReply();
  } else {
    loadingMessage = await embeds.loading(context, `Searching for images: **${query}**...`);
  }

  try {
    // Make API request to Google Custom Search
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_IMG}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=active`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    // Delete loading message for prefix
    if (!isInteraction && loadingMessage) {
      try {
        await loadingMessage.delete();
      } catch (error) {
        // Ignore deletion errors
      }
    }

    // Check if we got results
    if (!data.items || data.items.length === 0) {
      if (isInteraction) {
        return context.editReply({ content: `No images found for: **${query}**` });
      }
      return embeds.warn(context, `No images found for: **${query}**`, false);
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
      const user = context.user || context.author;

      const embed = new EmbedBuilder()
        .setColor(colors.info)
        .setDescription(`${emojis.google} **Google Image search**: ${query}`)
        .setImage(image.url)
        .setFooter({
          text: `Page ${currentPage} of ${totalPages} • ${image.displayLink}`,
          iconURL: user.displayAvatarURL({ dynamic: true })
        });

      return embed;
    };

    // Create pagination with 1 image per page
    await createPagination(context, images, formatPage, 1, `Image Search: ${query}`);

  } catch (error) {
    // Delete loading message if it still exists
    if (!isInteraction && loadingMessage) {
      try {
        await loadingMessage.delete();
      } catch (deleteError) {
        // Ignore deletion errors
      }
    }

    // Handle specific error cases
    if (error.message.includes('403')) {
      return embeds.warn(context, 'Google Custom Search API quota exceeded or invalid API key.', false);
    } else if (error.message.includes('400')) {
      return embeds.warn(context, 'Invalid search query. Please try a different search term.', false);
    } else {
      return embeds.warn(context, 'Failed to search for images. Please try again later.', false);
    }
  }
}

module.exports = {
  name: "image",
  aliases: ['img', 'search'],
  description: `Search for images using Google Custom Search`,
  syntax: 'image [query]',
  example: 'image cats',
  cooldown: 3000,
  
  run: async (client, message, args) => {
    if (message.guild) {
      await ensureGuildData(message.guild.id);
    }

    const query = args.join(' ');
    if (!query) {
      return runHelpCommand(message, 'image');
    }

    return await imageSearchShared(message, query);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Search for images using Google Custom Search')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('What to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('query');
    return await imageSearchShared(interaction, query);
  }
};
