const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { ensureGuildData } = require('../../database');
const { createConfirmation } = require('../../core/buttons');
const guildCache = require('../../database/cache/models/guild');
const config = require('../../config/setup');

module.exports = {
  name: "clearguildhistory",
  aliases: ['cgh'],
  description: `clear the server's name change history`,
  usage: `{guildprefix}clearguildnamehistory
{guildprefix}cgnh`,
  permission: 'dev',
  run: async(client, message, args) => {

    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    // Ensure guild data exists in the database
    await ensureGuildData(message.guild.id);

    try {
      const nameHistory = await guildCache.getGuildNameHistory(message.guild.id);

      if (nameHistory.length === 0) {
        return embeds.warn(message, 'No guild name history to clear');
      }

      // Show confirmation dialog
      await createConfirmation(
        message,
        `Are you sure you want to **clear all guild name history** for **${message.guild.name}**?`,
        async (interaction) => {
          // On approve: clear all guild name history
          await guildCache.clearAllGuildNameHistory(message.guild.id);

          // Edit the confirmation embed to show success message
          const successEmbed = embeds.createSuccess(message, `Cleared all guild name history for **${message.guild.name}**`);

          await interaction.editReply({ embeds: [successEmbed], components: [] });
        }
      );
    } catch (error) {
      console.error('Error clearing guild name history:', error);
      return embeds.deny(message, 'Failed to clear guild name history');
    }
  }
}
