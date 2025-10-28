const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { ensureGuildData } = require('../../database');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const config = require('../../config/setup');

module.exports = {
  name: "clearservernames",
  aliases: ['cgn'],
  description: `clear the server's name change history`,
  syntax: 'clearservernames [server id]',
  example: 'clearservernames 1431034951909904435',
  permission: 'dev',
  run: async (client, message, args) => {
    const guildService = getService('guild');

    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    // Determine which guild to clear
    let targetGuildId = message.guild.id;
    let targetGuildName = message.guild.name;

    // If an argument is provided, try to use it as a guild ID
    if (args[0]) {
      targetGuildId = args[0];
      
      // Try to fetch guild info from client
      try {
        const fetchedGuild = client.guilds.cache.get(targetGuildId);
        if (fetchedGuild) {
          targetGuildName = fetchedGuild.name;
        } else {
          targetGuildName = `Server ${targetGuildId}`;
        }
      } catch (error) {
        targetGuildName = `Server ${targetGuildId}`;
      }
    }

    // Ensure guild data exists in the database
    await ensureGuildData(targetGuildId);

    try {
      const nameHistory = await guildService.getGuildNameHistory(targetGuildId);

      if (nameHistory.length === 0) {
        return embeds.warn(message, 'No guild name history to clear');
      }

      // Show confirmation dialog
      await createConfirmation(
        message,
        `Are you sure you want to **clear** all guild name history for **${targetGuildName}**?`,
        async (interaction) => {
          // On approve: clear all guild name history
          await guildService.clearAllGuildNameHistory(targetGuildId);

          // Edit the confirmation embed to show success message
          const successEmbed = embeds.createSuccess(message, `**Cleared** all guild name history for **${targetGuildName}**`);

          await interaction.editReply({ embeds: [successEmbed], components: [] });
        }
      );
    } catch (error) {
      console.error('Error clearing guild name history:', error);
      return embeds.deny(message, 'Failed to clear guild name history');
    }
  }
}
