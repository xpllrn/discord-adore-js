const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('@services');
const logger = require('../../../utils/logger');
const axios = require('axios');

const API_BASE = 'https://api.truthordarebot.xyz/v1';

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

async function canUseRRating(guild, channel) {
  if (!guild) return true;
  if (channel.nsfw) return true;
  
  const guildService = getService('guild');
  const guildData = await guildService.ensureGuildData(guild.id);
  return guildData.NSFWBypass || false;
}

function createQuestionEmbed(data, authorName, authorIcon) {
  const embed = new EmbedBuilder()
    .setColor(colors.embed || '#242429')
    .setAuthor({
      name: `requested by ${authorName}`,
      iconURL: authorIcon
    })
    .setTitle(data.question)
    .setFooter({ text: `${data.rating} | ID: ${data.id}` });
  
  return embed;
}

function createSingleButton(label) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('nhie_next')
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
    );
}

function createDisabledButton(label) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('nhie_next_disabled')
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
}

async function setupCollector(message, user, channel, rating) {
  const collector = message.createMessageComponentCollector({
    time: 120000
  });

  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== user.id) {
      return interaction.reply({
        content: `${interaction.client.config?.emojis?.error || '❌'} This game is not for you!`,
        ephemeral: true
      });
    }

    const newQuestion = await fetchQuestion('nhie', rating);
    if (!newQuestion) {
      return interaction.reply({
        content: 'Failed to fetch question. Please try again.',
        ephemeral: true
      });
    }

    const newEmbed = createQuestionEmbed(newQuestion, user.username, user.displayAvatarURL({ dynamic: true }));
    const newButtons = createSingleButton('Never have I ever');

    // Disable old button
    try {
      await interaction.update({ components: [createDisabledButton('Never have I ever')] });
    } catch (error) {
      // Ignore
    }

    // Send new message
    const newMessage = await channel.send({ embeds: [newEmbed], components: [newButtons] });
    
    // Setup collector for new message recursively
    await setupCollector(newMessage, user, channel, rating);
  });

  collector.on('end', async () => {
    try {
      await message.edit({ components: [createDisabledButton('Never have I ever')] });
    } catch (error) {
      // Ignore
    }
  });
}

async function handleNhieGame(context, rating) {
  const isInteraction = !!context.user;
  const user = isInteraction ? context.user : context.author;
  const channel = context.channel;
  const guild = context.guild;

  if (rating === 'r') {
    const allowed = await canUseRRating(guild, channel);
    if (!allowed) {
      return embeds.deny(context, 'This command can **only be used** in `NSFW` channels!', false);
    }
  }

  const questionData = await fetchQuestion('nhie', rating);
  if (!questionData) {
    return embeds.deny(context, 'Failed to fetch question from API. Please try again later', false);
  }

  const embed = createQuestionEmbed(questionData, user.username, user.displayAvatarURL({ dynamic: true }));
  const buttons = createSingleButton('Never have I ever');

  let gameMessage;
  if (isInteraction) {
    await context.reply({ embeds: [embed], components: [buttons] });
    gameMessage = await context.fetchReply();
  } else {
    gameMessage = await context.channel.send({ embeds: [embed], components: [buttons] });
  }

  await setupCollector(gameMessage, user, channel, rating);
}

module.exports = {
  name: 'nhie',
  aliases: ['neverhaveiever'],
  description: 'Get a never have I ever question',
  syntax: 'nhie [--r]',
  example: 'nhie --r',
  cooldown: 3000,
  
  run: async (client, message, args) => {
    try {
      const rating = args.includes('--r') ? 'r' : 'pg';
      await handleNhieGame(message, rating);
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while starting the game');
    }
  },

  data: new SlashCommandBuilder()
    .setName('nhie')
    .setDescription('Get a never have I ever question')
    .addStringOption(option =>
      option
        .setName('rating')
        .setDescription('Question rating')
        .setRequired(false)
        .addChoices(
          { name: 'PG', value: 'pg' },
          { name: 'R', value: 'r' }
        )
    ),

  async execute(interaction) {
    try {
      const rating = interaction.options.getString('rating') || 'pg';
      await handleNhieGame(interaction, rating);
    } catch (error) {
      logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });
      return embeds.deny(interaction, 'An error occurred while executing the command', false).catch(() => {});
    }
  }
};
