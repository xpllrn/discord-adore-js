const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');

// Utility functions
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "economy",
  aliases: ['eco'],
  description: 'Manage user economy data (dev only)',
  syntax: 'economy reset [user]',
  example: 'economy reset\neconomy reset @user',
  permission: 'dev',
  run: async (client, message, args) => {
    const userService = getService('user');

    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0] || args[0].toLowerCase() !== 'reset') {
      return runHelpCommand(message, 'economy');
    }

    // Check if this is a global reset (no user specified)
    if (!args[1]) {
      // Global economy reset
      await createConfirmation(
        message,
        `⚠️ **GLOBAL ECONOMY RESET** ⚠️\n\nAre you sure you want to **reset ALL users' economy data globally**?\n\n**This will:**\n• Reset all wallets to 1,000 coins\n• Reset all banks to 0 coins\n• Clear all gambling statistics\n• Clear all vote data\n• Clear all cooldowns\n\n**THIS ACTION CANNOT BE UNDONE AND AFFECTS EVERYONE!**`,
        async (interaction) => {
          try {
            // Get the User model directly for bulk operations
            const { User } = require('../../database');
            const UserModel = User;

            // Reset all users' gambling data
            const defaultGamblingData = {
              wallet: 1000,
              bank: 0,
              dailyClaim: {
                lastClaimed: null,
                streak: 0
              },
              robCooldown: null,
              lastWorked: null,
              begCooldown: null,
              lastInterestClaim: null,
              lastVote: null,
              totalVotes: 0,
              totalGambled: 0,
              totalWon: 0,
              totalLost: 0
            };

            const result = await UserModel.updateMany(
              {}, // Empty filter = all documents
              { $set: { 'Gambling': defaultGamblingData } }
            );

            // Clear the service cache to ensure fresh data
            userService.clearCache();

            const successEmbed = embeds.createSuccess(
              message, 
              `🌍 **Global Economy Reset Complete**\n\n**${result.modifiedCount}** users affected\n\n**All users now have:**\n• **Wallet:** 1,000 coins\n• **Bank:** 0 coins\n• **All stats:** Reset to 0`
            );

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          } catch (error) {
            console.error('Error performing global economy reset:', error);
            const errorEmbed = embeds.createDeny(message, 'Failed to perform global economy reset');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        }
      );
      return;
    }

    // Individual user reset
    const userResult = await findUser(message.guild, args[1], client);

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

    try {
      // Get current gambling data
      const gambling = await userService.getGamblingData(targetUser.id);
      const username = targetMember ? targetMember.displayName : targetUser.username;

      // Show confirmation dialog with current stats
      const currentStats = [
        `**Wallet:** ${formatCurrency(gambling.wallet || 0)} coins`,
        `**Bank:** ${formatCurrency(gambling.bank || 0)} coins`,
        `**Total Votes:** ${gambling.totalVotes || 0}`,
        `**Total Gambled:** ${formatCurrency(gambling.totalGambled || 0)} coins`,
        `**Total Won:** ${formatCurrency(gambling.totalWon || 0)} coins`,
        `**Total Lost:** ${formatCurrency(gambling.totalLost || 0)} coins`
      ].join('\n');

      await createConfirmation(
        message,
        `Are you sure you want to **reset** all economy data for **${username}**?\n\n**Current Stats:**\n${currentStats}\n\n**This action cannot be undone!**`,
        async (interaction) => {
          // Reset all gambling data to defaults
          await userService.setUserField(targetUser.id, 'Gambling', {
            wallet: 1000, // Starting wallet balance
            bank: 0,
            dailyClaim: {
              lastClaimed: null,
              streak: 0
            },
            robCooldown: null,
            lastWorked: null,
            begCooldown: null,
            lastInterestClaim: null,
            lastVote: null,
            totalVotes: 0,
            totalGambled: 0,
            totalWon: 0,
            totalLost: 0
          });

          // Edit the confirmation embed to show success message
          const successEmbed = embeds.createSuccess(
            message, 
            `**Successfully reset** economy data for **${username}**\n\n**New Stats:**\n**Wallet:** 1,000 coins\n**Bank:** 0 coins\n**All other stats:** Reset to 0`
          );

          await interaction.editReply({ embeds: [successEmbed], components: [] });
        }
      );
    } catch (error) {
      console.error('Error resetting economy data:', error);
      return embeds.deny(message, 'Failed to reset economy data');
    }
  }
};