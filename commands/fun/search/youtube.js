const { SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { ensureGuildData } = require('../../../database');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const ytsearch = require("yt-search");
const logger = require('../../../utils/logger');

// Shared logic for YouTube search
async function youtubeSearchShared(context, query) {
  const isInteraction = !!context.user;

  try {
    const res = await ytsearch(query);

    if (!res || !res.videos || res.videos.length === 0) {
      return embeds.warn(context, 'No **results** found for your search', false);
    }

    const video = res.videos[0];

    if (!video || !video.url) {
      return embeds.warn(context, 'No **video** found', false);
    }

    const spoilerText = `||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| _ _ _ _ _ _  ${video.url}`;

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
