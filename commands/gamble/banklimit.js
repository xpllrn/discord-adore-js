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

function parseAmount(input) {
  if (!input || typeof input !== 'string') return null;

  const cleanInput = input.toLowerCase().replace(/[,\s]/g, '');
  const amount = parseInt(cleanInput);
  
  if (isNaN(amount) || amount < 0) return null;
  return amount;
}

module.exports = {
  name: "banklimit",
  aliases: ["setbanklimit", "bl"],
  description: 'Manage user bank limits (dev only)',
  syntax: 'banklimit <user> [amount]\nbanklimit reset <user>\nbanklimit reset all\nbanklimit fix\nbanklimit debug <user>',
  example: 'banklimit @user 100000\nbanklimit @user\nbanklimit reset @user\nbanklimit reset all\nbanklimit fix\nbanklimit debug @user',
  permission: 'dev',
  run: async (client, message, args) => {
    const userService = getService('user');

    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'banklimit');
    }

    // Handle debug command
    if (args[0].toLowerCase() === 'debug') {
      if (!args[1]) {
        return embeds.warn(message, 'Please specify a user to debug: `banklimit debug @user`');
      }

      const userResult = await findUser(message.guild, args[1], client);
      if (!userResult.found) {
        return embeds.warn(message, userResult.error || 'User not found');
      }

      let targetUser;
      if (userResult.isGlobal) {
        targetUser = userResult.user;
      } else {
        targetUser = userResult.user.user || userResult.user;
      }

      try {
        // Get current data and show debug info
        const gambling = await userService.getGamblingData(targetUser.id);
        const bankLimit = await userService.getBankLimit(targetUser.id);
        
        // Force a cache refresh and check again
        userService.cache.delete(targetUser.id);
        const freshGambling = await userService.getGamblingData(targetUser.id);
        const freshBankLimit = await userService.getBankLimit(targetUser.id);

        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('🔍 Bank Limit Debug Information')
          .setDescription(`Debug info for **${targetUser.username}**`)
          .addFields(
            { name: 'Cached Bank Limit', value: `${formatCurrency(bankLimit)}`, inline: true },
            { name: 'Fresh Bank Limit', value: `${formatCurrency(freshBankLimit)}`, inline: true },
            { name: 'Match?', value: bankLimit === freshBankLimit ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Cached Wallet', value: `${formatCurrency(gambling.wallet || 0)}`, inline: true },
            { name: 'Fresh Wallet', value: `${formatCurrency(freshGambling.wallet || 0)}`, inline: true },
            { name: 'Cache Status', value: userService.cache.has(targetUser.id) ? 'Cached' : 'Not Cached', inline: true }
          )
          .setFooter({ text: 'Check console logs for detailed debug information' });

        return message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error in debug command:', error);
        return embeds.deny(message, 'Failed to get debug information');
      }
    }

    // Handle fix command (fix missing bank limits without resetting existing ones)
    if (args[0].toLowerCase() === 'fix') {
      await createConfirmation(
        message,
        `🔧 **FIX MISSING BANK LIMITS** 🔧\n\nThis will **add default bank limits (50,000) to users who are missing them** without affecting users who already have bank limits set.\n\n**This will:**\n• Add bank limits to users missing them\n• NOT change existing bank limits\n• Only affect users with missing data\n\n**This is safe to run!**`,
        async (interaction) => {
          try {
            // Get the User model directly for bulk operations
            const { User } = require('../../database');
            const UserModel = User;

            // Fix users who have gambling data but no bankLimit field
            const result = await UserModel.updateMany(
              { 'Gambling': { $exists: true }, 'Gambling.bankLimit': { $exists: false } },
              { $set: { 'Gambling.bankLimit': 50000 } }
            );

            // Clear the service cache to ensure fresh data
            userService.clearCache();

            const successEmbed = embeds.createSuccess(
              message, 
              `🔧 **Missing Bank Limits Fixed**\n\n**${result.modifiedCount}** users had missing bank limits fixed\n\n**Fixed users now have:**\n• **Bank Limit:** 50,000 coins`
            );

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          } catch (error) {
            console.error('Error fixing missing bank limits:', error);
            
            const errorEmbed = embeds.createDeny(message, 'Failed to fix missing bank limits');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        }
      );
      return;
    }

    // Handle reset commands
    if (args[0].toLowerCase() === 'reset') {
      if (!args[1]) {
        return embeds.warn(message, 'Please specify a user or "all" to reset bank limits');
      }

      if (args[1].toLowerCase() === 'all') {
        // Global bank limit reset
        await createConfirmation(
          message,
          `⚠️ **GLOBAL BANK LIMIT RESET** ⚠️\n\nAre you sure you want to **reset ALL users' bank limits to 50,000**?\n\n**This will:**\n• Reset all bank limits to default (50,000)\n• Fix users with missing bank limits\n• Affect all users globally\n\n**THIS ACTION CANNOT BE UNDONE!**`,
          async (interaction) => {
            try {
              // Get the User model directly for bulk operations
              const { User } = require('../../database');
              const UserModel = User;

              // Reset all users' bank limits to default and fix missing bank limits
              const result = await UserModel.updateMany(
                {}, // Empty filter = all documents
                { $set: { 'Gambling.bankLimit': 50000 } }
              );

              // Also fix users who might have gambling data but no bankLimit field
              const fixResult = await UserModel.updateMany(
                { 'Gambling': { $exists: true }, 'Gambling.bankLimit': { $exists: false } },
                { $set: { 'Gambling.bankLimit': 50000 } }
              );

              // Clear the service cache to ensure fresh data
              userService.clearCache();

              const successEmbed = embeds.createSuccess(
                message, 
                `🌍 **Global Bank Limit Reset Complete**\n\n**${result.modifiedCount}** users reset\n**${fixResult.modifiedCount}** users fixed (missing bank limits)\n\n**All users now have:**\n• **Bank Limit:** 50,000 coins`
              );

              await interaction.editReply({ embeds: [successEmbed], components: [] });
            } catch (error) {
              console.error('Error performing global bank limit reset:', error);
              
              const errorEmbed = embeds.createDeny(message, 'Failed to perform global bank limit reset');
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
        // Get current bank limit
        const currentLimit = await userService.getBankLimit(targetUser.id);
        const username = targetMember ? targetMember.displayName : targetUser.username;

        await createConfirmation(
          message,
          `Are you sure you want to **reset** the bank limit for **${username}**?\n\n**Current Bank Limit:** ${formatCurrency(currentLimit)} coins\n**New Bank Limit:** 50,000 coins\n\n**This action cannot be undone!**`,
          async (interaction) => {
            try {
              // Reset bank limit to default
              await userService.updateBankLimit(targetUser.id, 50000);

              const successEmbed = embeds.createSuccess(
                message, 
                `**Successfully reset** bank limit for **${username}**\n\n**New Bank Limit:** 50,000 coins`
              );

              await interaction.editReply({ embeds: [successEmbed], components: [] });
            } catch (error) {
              console.error('Error resetting individual bank limit:', error);
              
              const errorEmbed = embeds.createDeny(message, 'Failed to reset bank limit');
              await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }
          }
        );
      } catch (error) {
        console.error('Error resetting bank limit:', error);
        return embeds.deny(message, 'Failed to reset bank limit');
      }
      return;
    }

    // Handle user lookup/modification
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

    const username = targetMember ? targetMember.displayName : targetUser.username;

    // If no amount specified, show current bank limit
    if (!args[1]) {
      try {
        const currentLimit = await userService.getBankLimit(targetUser.id);
        const gambling = await userService.getGamblingData(targetUser.id);
        const bankBalance = gambling.bank || 0;

        const embed = new EmbedBuilder()
          .setColor('#729bb0')
          .setTitle('Bank Limit Information')
          .setDescription(`**${username}**'s bank information`)
          .addFields(
            { name: 'Current Bank Balance', value: `${formatCurrency(bankBalance)} coins`, inline: true },
            { name: 'Bank Limit', value: `${formatCurrency(currentLimit)} coins`, inline: true },
            { name: 'Available Space', value: `${formatCurrency(currentLimit - bankBalance)} coins`, inline: true }
          )
          .setThumbnail(targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ dynamic: true }) : null);

        return message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error getting bank limit info:', error);
        return embeds.deny(message, 'Failed to get bank limit information');
      }
    }

    // Parse and set new bank limit
    const newLimit = parseAmount(args[1]);

    if (newLimit === null) {
      return embeds.deny(message, 'Please provide a valid bank limit amount');
    }

    if (newLimit < 0) {
      return embeds.deny(message, 'Bank limit cannot be negative');
    }

    if (newLimit > 100000000) { // 100 million max
      return embeds.deny(message, 'Bank limit cannot exceed 100,000,000 coins');
    }

    try {
      const currentLimit = await userService.getBankLimit(targetUser.id);

      await createConfirmation(
        message,
        `Are you sure you want to **change** the bank limit for **${username}**?\n\n**Current Bank Limit:** ${formatCurrency(currentLimit)} coins\n**New Bank Limit:** ${formatCurrency(newLimit)} coins\n\n**This action cannot be undone!**`,
        async (interaction) => {
          try {
            // Update bank limit
            await userService.updateBankLimit(targetUser.id, newLimit);

            const successEmbed = embeds.createSuccess(
              message, 
              `**Successfully updated** bank limit for **${username}**\n\n**Previous Limit:** ${formatCurrency(currentLimit)} coins\n**New Limit:** ${formatCurrency(newLimit)} coins`
            );

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          } catch (error) {
            console.error('Error updating bank limit:', error);
            
            const errorEmbed = embeds.createDeny(message, 'Failed to update bank limit');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        }
      );
    } catch (error) {
      console.error('Error updating bank limit:', error);
      return embeds.deny(message, 'Failed to update bank limit');
    }
  }
};