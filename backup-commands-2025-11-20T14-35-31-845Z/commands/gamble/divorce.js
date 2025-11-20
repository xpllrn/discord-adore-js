const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const { colors } = require('../../config/setup');
const logger = require('../../utils/logger');

module.exports = {
  name: "divorce",
  aliases: ['unmarry'],
  description: 'Divorce your current partner',
  syntax: 'divorce',
  example: 'divorce',
  run: async (client, message, args) => {
    
    try {
      const userService = getService('user');

      // Check if user is married
      const userData = await userService.get(message.author.id);
      const marriage = userData?.Marriage;

      if (!marriage || !marriage.partnerId) {
        return embeds.warn(message, 'You are not married to anyone!');
      }

      // Get partner data
      const partner = await client.users.fetch(marriage.partnerId).catch(() => null);
      const partnerName = partner ? partner.username : 'Unknown User';

      // Create confirmation
      const confirmationText = `💔 Are you sure you want to divorce **${partnerName}**?\n\nThis action cannot be undone.`;

      await createConfirmation(
        message,
        confirmationText,
        async (interaction) => {
          try {
            // Remove marriage data for both users
            await userService.setUserField(message.author.id, 'Marriage', {
              partnerId: null,
              marriedAt: null,
              ringId: null
            });

            if (marriage.partnerId) {
              await userService.setUserField(marriage.partnerId, 'Marriage', {
                partnerId: null,
                marriedAt: null,
                ringId: null
              });
            }

            // Success message
            const successEmbed = embeds.createSuccess(message, `💔 <@${message.author.id}> has divorced <@${marriage.partnerId}>.`);

            await interaction.editReply({ embeds: [successEmbed], components: [] });

          } catch (error) {
            logger.webhook.error(error, message);
            const errorEmbed = embeds.createDeny(message, 'An error occurred while processing the divorce.');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        }
      );

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while processing the divorce.');
    }
  }
};
