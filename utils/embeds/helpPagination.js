const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { colors, emojis } = require('../../config/setup');

/**
 * Creates and manages paginated help display
 * @param {Object} message - Discord message object
 * @param {Array} pages - Array of embed pages
 * @param {String} moduleName - Command module name
 * @returns {Promise} - Resolves when pagination ends
 */
async function createHelpPagination(message, pages, moduleName) {
  if (!pages || pages.length === 0) {
    return;
  }

  const totalPages = pages.length;
  let currentPage = 1;

  // Create buttons
  const createButtons = (page, disabled = false) => {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_left')
          .setEmoji(emojis.left)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === 1),
        new ButtonBuilder()
          .setCustomId('help_cancel')
          .setEmoji(emojis.cancel)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId('help_right')
          .setEmoji(emojis.right)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === totalPages)
      );
    return row;
  };

  // Send initial message with first page
  const buttons = createButtons(currentPage);
  const sentMessage = await message.channel.send({
    embeds: [pages[0]],
    components: [buttons]
  });

  // Only create collector if there are multiple pages
  if (totalPages === 1) {
    return;
  }

  // Create collector with 60-second timeout (longer for reading help)
  const collector = sentMessage.createMessageComponentCollector({
    time: 60000 // 60 seconds timeout
  });

  collector.on('collect', async (interaction) => {
    try {
      // Check if interaction is still valid
      if (!interaction.isRepliable()) {
        return;
      }

      // Check if the user is the author of the command
      if (interaction.user.id !== message.author.id) {
        const warnEmbed = new EmbedBuilder()
          .setColor(colors.warn)
          .setDescription(`${emojis.warn} <@${interaction.user.id}>: You are **NOT** the author of this embed`);

        return interaction.reply({
          embeds: [warnEmbed],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'help_left') {
        // Navigate to previous page
        currentPage = Math.max(1, currentPage - 1);

        const newButtons = createButtons(currentPage);

        try {
          await interaction.update({
            embeds: [pages[currentPage - 1]],
            components: [newButtons]
          });
        } catch (error) {
          if (error.code === 10062) {
            // Unknown interaction - try editing the message directly
            await sentMessage.edit({ 
              embeds: [pages[currentPage - 1]], 
              components: [newButtons] 
            });
          } else {
            throw error;
          }
        }

      } else if (interaction.customId === 'help_right') {
        // Navigate to next page
        currentPage = Math.min(totalPages, currentPage + 1);

        const newButtons = createButtons(currentPage);

        try {
          await interaction.update({
            embeds: [pages[currentPage - 1]],
            components: [newButtons]
          });
        } catch (error) {
          if (error.code === 10062) {
            // Unknown interaction - try editing the message directly
            await sentMessage.edit({ 
              embeds: [pages[currentPage - 1]], 
              components: [newButtons] 
            });
          } else {
            throw error;
          }
        }

      } else if (interaction.customId === 'help_cancel') {
        // Disable all buttons and stop collector
        const disabledButtons = createButtons(currentPage, true);
        
        try {
          await interaction.update({
            components: [disabledButtons]
          });
        } catch (error) {
          if (error.code === 10062) {
            // Unknown interaction - try editing the message directly
            await sentMessage.edit({ components: [disabledButtons] });
          } else {
            throw error;
          }
        }
        
        collector.stop();
      }

      // Reset collector timer on each interaction
      collector.resetTimer();

    } catch (error) {
      console.error('Error handling help pagination interaction:', error);
    }
  });

  collector.on('end', async () => {
    try {
      // Disable all buttons when collector ends
      const disabledButtons = createButtons(currentPage, true);
      await sentMessage.edit({
        components: [disabledButtons]
      });
    } catch (error) {
      // Message might have been deleted, ignore error
    }
  });
}

module.exports = {
  createHelpPagination
};
