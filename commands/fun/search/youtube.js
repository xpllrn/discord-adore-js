const { SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { ensureGuildData } = require('../../../database');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { google } = require('googleapis');
const logger = require('../../../utils/logger');

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.GOOGLE_IMG
});

// Shared logic for YouTube search
async function youtubeSearchShared(context, query) {
  const isInteraction = !!context.user;

  try {
    const searchResponse = await youtube.search.list({
      part: 'snippet',
      q: query,
      maxResults: 1,
      type: 'video'
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return embeds.warn(context, 'No **results** found for your search', false);
    }

    const video = searchResponse.data.items[0];
    const videoId = video.id.videoId;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (!videoUrl) {
      return embeds.warn(context, 'No **video** found', false);
    }

    const spoilerText = `||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| _ _ _ _ _ _  ${videoUrl}`;

    if (isInteraction) {
      return context.reply(spoilerText);
    } else {
      return context.channel.send(spoilerText);
    }

  } catch (error) {
    logger.webhook.error(error, context);
    return embeds.deny(context, 'An error occurred while searching YouTube', false);
  }
}

module.exports = {
  name: "youtube",
  aliases: ['yt'],
  description: `search for a song/video on youtube`,
  syntax: 'youtube [query]',
  example: 'youtube never gonna give you up',
  
  run: async(client, message, args) => {
    if (message.guild) {
      await ensureGuildData(message.guild.id);
    }

    const youtubesearch = args.join(' ');

    if (!youtubesearch) {
      return runHelpCommand(message, 'youtube');
    }

    return await youtubeSearchShared(message, youtubesearch);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Search for a song/video on YouTube')
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
    return await youtubeSearchShared(interaction, query);
  }
}
