const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { ensureUserData } = require('../../database');
const { createConfirmation } = require('../../core/buttons');
const userCache = require('../../database/cache/models/user');
const config = require('../../config/setup');

module.exports = {
  name: "clearnamehistory",
  aliases: ['cnh'],
  description: `clear a user's name change history`,
  usage: `{guildprefix}clearnamehistory [user]
{guildprefix}cnh [user]`,
  permission: 'dev',
  run: async(client, message, args) => {

    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'clearnamehistory');
    }

    // Find the target user
    const userResult = await findUser(message.guild, args[0], client);
    
    if (!userResult.found) {
      return embeds.warn(message, userResult.error || 'User not found');
    }

    let targetUser, targetMember;
    if (userResult.isGlobal) {
      targetUser = userResult.user;
      targetMember = null;
    } else {
      targetUser = userResult.user.user || userResult.user;
      targetMember = userResult.user;
    }

    // Ensure user data exists in the database
    await ensureUserData(targetUser.id);

    try {
      const nameHistory = await userCache.getNameHistory(targetUser.id);

      if (nameHistory.length === 0) {
        const username = targetMember ? targetMember.displayName : targetUser.username;
        return embeds.warn(message, `**${username}** has no name history to clear`);
      }

      const username = targetMember ? targetMember.displayName : targetUser.username;

      // Show confirmation dialog
      await createConfirmation(
        message,
        `Are you sure you want to **clear all name history** for **${username}**?`,
        async (interaction) => {
          // On approve: clear all name history
          await userCache.clearAllNameHistory(targetUser.id);

          // Edit the confirmation embed to show success message
          const successEmbed = embeds.createSuccess(message, `Cleared all name history for **${username}**`);

          await interaction.editReply({ embeds: [successEmbed], components: [] });
        }
      );
    } catch (error) {
      console.error('Error clearing name history:', error);
      return embeds.deny(message, 'Failed to clear name history');
    }
  }
}
