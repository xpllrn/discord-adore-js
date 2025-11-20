const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors } = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const logger = require('../../utils/logger');

module.exports = {
  name: "define",
  aliases: ['def'],
  description: "Get the definition of a word",
  syntax: 'define (word)',
  example: 'define serendipity',
  run: async (client, message, args) => {
    try {
      if (!args[0]) {
        return runHelpCommand(message, 'define');
      }

      const word = args.join(' ').toLowerCase();

      // Use Free Dictionary API
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return embeds.warn(message, `No definition found for **${word}**`);
        }
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || data.length === 0) {
        return embeds.warn(message, `No definition found for **${word}**`);
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

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching the definition. Please try again.');
    }
  }
};
