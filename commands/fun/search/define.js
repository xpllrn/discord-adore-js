const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

// Shared logic for dictionary lookup
async function defineLookupShared(context, word) {
  const isInteraction = !!context.user;

  try {
    // Use Free Dictionary API
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return embeds.warn(context, `No **definition** found for **${word}**`, false);
      }
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return embeds.warn(context, `No **definition** found for **${word}**`, false);
    }

    const entry = data[0];
    const meaning = entry.meanings[0];
    const definition = meaning.definitions[0];

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle(`📖 ${entry.word}`)
      .setTimestamp();

    // Add phonetic if available
    if (entry.phonetic) {
      embed.setDescription(`**Pronunciation:** ${entry.phonetic}`);
    }

    // Add part of speech and definition
    let definitionText = `**${meaning.partOfSpeech}**\n${definition.definition}`;

    // Add example if available
    if (definition.example) {
      definitionText += `\n\n**Example:** *${definition.example}*`;
    }

    // Add synonyms if available
    if (definition.synonyms && definition.synonyms.length > 0) {
      const synonyms = definition.synonyms.slice(0, 5).join(', ');
      definitionText += `\n\n**Synonyms:** ${synonyms}`;
    }

    embed.addFields({
      name: 'Definition',
      value: definitionText.length > 1024 ? definitionText.substring(0, 1021) + '...' : definitionText
    });

    // Add source URL if available
    if (entry.sourceUrls && entry.sourceUrls.length > 0) {
      embed.setFooter({ text: `Source: ${entry.sourceUrls[0]}` });
    }

    if (isInteraction) {
      return interaction.reply({ embeds: [embed] });
    } else {
      return context.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    logger.webhook.error(error, context);
    return embeds.deny(context, 'An error occurred while fetching the definition. Please try again.', false);
  }
}

module.exports = {
  name: "define",
  aliases: ['def'],
  description: "Get the definition of a word",
  syntax: 'define [word]',
  example: 'define serendipity',
  
  run: async (client, message, args) => {
    if (!args[0]) {
      return runHelpCommand(message, 'define');
    }

    const word = args.join(' ').toLowerCase();
    return await defineLookupShared(message, word);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('define')
    .setDescription('Get the definition of a word')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addStringOption(option =>
      option
        .setName('word')
        .setDescription('The word to define')
        .setRequired(true)
    ),

  async execute(interaction) {
    const word = interaction.options.getString('word').toLowerCase();
    return await defineLookupShared(interaction, word);
  }
};
