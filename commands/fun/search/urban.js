const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { createPagination } = require('../../../core/buttons');

module.exports = {
  name: "urban",
  aliases: ['ud'],
  description: "Get the Urban Dictionary definition of a word or phrase",
  syntax: 'urban (word)',
  example: 'urban pineapple',
  run: async (client, message, args) => {
    try {
      if (!args[0]) {
        return runHelpCommand(message, 'ud');
      }

      const term = args.join(' ');

      // Use Urban Dictionary API
      const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.list || data.list.length === 0) {
        return embeds.warn(message, `No Urban Dictionary definition found for **${term}**`);
      }

      // Get all definitions (limit to first 10 for performance)
      const definitions = data.list.slice(0, 10);

      // Function to format each page
      const formatPage = (pageDefinitions, currentPage, totalPages) => {
        const definition = pageDefinitions[0]; // Each page shows one definition

        // Clean up the definition text (remove brackets)
        const cleanDefinition = definition.definition.replace(/\[|\]/g, '');
        const cleanExample = definition.example ? definition.example.replace(/\[|\]/g, '') : null;

        // Build embed
        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`${definition.word}`)

        // Add definition
        let definitionText = cleanDefinition;

        // Truncate if too long
        if (definitionText.length > 1000) {
          definitionText = definitionText.substring(0, 997) + '...';
        }

        embed.addFields({
          name: 'Definition',
          value: definitionText
        });

        // Add example if available
        if (cleanExample) {
          let exampleText = cleanExample;

          // Truncate if too long
          if (exampleText.length > 1000) {
            exampleText = exampleText.substring(0, 997) + '...';
          }

          embed.addFields({
            name: 'Example',
            value: exampleText
          });
        }

        // Add vote counts
        const voteText = '``👍 ' + definition.thumbs_up + ' | 👎 ' + definition.thumbs_down + '``';
        embed.addFields({
          name: 'Votes',
          value: voteText,
          inline: true
        });

        // Add author
        const authorText = '``By ' + definition.author + '``';
        embed.addFields({
          name: 'Author',
          value: authorText,
          inline: true
        });

        // Add page info in footer
        embed.setFooter({
          text: `Urban Dictionary • Page ${currentPage}/${totalPages}`
        });

        return embed;
      };

      // Use pagination with 1 definition per page
      await createPagination(
        message,
        definitions,
        formatPage,
        1, // 1 definition per page
        `Urban Dictionary: ${term}`
      );

    } catch (error) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Urban Command', {
          command: 'urban',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      return embeds.deny(message, 'An error occurred while fetching the Urban Dictionary definition. Please try again.');
    }
  }
};
