const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('@services');
const logger = require('../../../utils/logger');
const axios = require('axios');

const API_BASE = 'https://api.truthordarebot.xyz/v1';
const activeGames = new Map();

/**
 * Fetch question from API
 */
async function fetchQuestion(type, rating = 'pg') {
  try {
    const validRatings = rating.toLowerCase() === 'r' ? 'r' : 'pg&rating=pg13';
    const response = await axios.get(`${API_BASE}/${type}?rating=${validRatings}`, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${type} question:`, error.message);
    return null;
  }
}

/**
 * Check if R-rated content is allowed
 */
async function canUseRRating(guild, channel) {
  if (!guild) return true;
  if (channel.nsfw) return true;
  
  const guildService = getService('guild');
  const guildData = await guildService.ensureGuildData(guild.id);
  return guildData.NSFWBypass || false;
}

/**
 * Create question embed
 */
function createQuestionEmbed(data, authorName, authorIcon) {
  const embed = new EmbedBuilder()
    .setColor(colors.embed || '#242429')
    .setAuthor({
      name: `${authorName}: requested by ${authorName}`,
      iconURL: authorIcon
    })
    .setTitle(data.question)
    .setFooter({ text: `${data.rating} | ID: ${data.id}` });
  
  return embed;
}

/**
 * Create buttons for truth/dare
 */
function createTruthDareButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('tod_truth')
        .setLabel('Truth')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('tod_random')
        .setLabel('Random')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tod_dare')
        .setLabel('Dare')
        .setStyle(ButtonStyle.Danger)
    );
}

/**
 * Handle truth/dare game
 */
async function handleTruthDareGame(context, initialType, rating) {
  const isInteraction = !!context.user;
  const user = isInteraction ? context.user : context.author;
  const channel = context.channel;
  const guild = context.guild;

  // Check R rating permission
  if (rating === 'r') {
    const allowed = await canUseRRating(guild, channel);
    if (!allowed) {
      return embeds.deny(context, 'R-rated content is only available in **NSFW channels** or servers with **NSFW bypass** enabled', false);
    }
  }

  // Fetch initial question
  const questionData = await fetchQuestion(initialType, rating);
  if (!questionData) {
    return embeds.deny(context, 'Failed to fetch question from API. Please try again later', false);
  }

  const embed = createQuestionEmbed(questionData, user.username, user.displayAvatarURL({ dynamic: true }));
  const buttons = createTruthDareButtons();

  let gameMessage;
  if (isInteraction) {
    await context.reply({ embeds: [embed], components: [buttons] });
    gameMessage = await context.fetchReply();
  } else {
    gameMessage = await context.channel.send({ embeds: [embed], components: [buttons] });
  }

  // Store game state
  const gameKey = `${channel.id}-${gameMessage.id}`;
  activeGames.set(gameKey, {
    userId: user.id,
    rating,
    messageId: gameMessage.id
  });

  // Create collector
  const collector = gameMessage.createMessageComponentCollector({
    time: 60000
  });

  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== user.id) {
      return interaction.reply({
        content: `${interaction.client.config?.emojis?.error || '❌'} This game is not for you!`,
        ephemeral: true
      });
    }

    const buttonType = interaction.customId.split('_')[1];
    let newType = buttonType;

    if (buttonType === 'random') {
      newType = Math.random() < 0.5 ? 'truth' : 'dare';
    }

    const newQuestion = await fetchQuestion(newType, rating);
    if (!newQuestion) {
      return interaction.reply({
        content: 'Failed to fetch question. Please try again.',
        ephemeral: true
      });
    }

    const newEmbed = createQuestionEmbed(newQuestion, user.username, user.displayAvatarURL({ dynamic: true }));
    const newButtons = createTruthDareButtons();

    await interaction.update({ embeds: [newEmbed], components: [newButtons] });
  });

  collector.on('end', async () => {
    try {
      const disabledButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('tod_truth_disabled')
            .setLabel('Truth')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('tod_random_disabled')
            .setLabel('Random')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('tod_dare_disabled')
            .setLabel('Dare')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await gameMessage.edit({ components: [disabledButtons] });
      activeGames.delete(gameKey);
    } catch (error) {
      // Ignore edit errors
    }
  });
}

module.exports = {
  name: 'dare',
  aliases: [],
  description: 'Play truth or dare game',
  syntax: 'dare [--r]',
  example: 'dare --r',
  cooldown: 3000,
  
  run: async (client, message, args) => {
    try {
      const rating = args.includes('--r') ? 'r' : 'pg';
      await handleTruthDareGame(message, 'dare', rating);
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while starting the game');
    }
  },

  data: new SlashCommandBuilder()
    .setName('dare')
    .setDescription('Get a dare challenge')
    .addStringOption(option =>
      option
        .setName('rating')
        .setDescription('Question rating')
        .setRequired(false)
        .addChoices(
          { name: 'PG/PG13', value: 'pg' },
          { name: 'R (18+)', value: 'r' }
        )
    ),

  async execute(interaction) {
    try {
      const rating = interaction.options.getString('rating') || 'pg';
      await handleTruthDareGame(interaction, 'dare', rating);
    } catch (error) {
      logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });
      return embeds.deny(interaction, 'An error occurred while executing the command', false).catch(() => {});
    }
  }
};
