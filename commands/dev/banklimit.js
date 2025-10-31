const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { ensureUserData } = require('../../database');
const { getService } = require('@services');

// Utility function
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "banklimit",
  aliases: ["setbanklimit", "bl"],
  description: 'Set a user\'s bank limit',
  syntax: 'banklimit <user> <amount>',
  example: 'banklimit @user 102020',
  permission: 'dev',
  run: async (client, message, args) => {
    
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    // Check if user provided arguments
    if (!args[0] || !args[1]) {
      return runHelpCommand(message, 'banklimit');
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

    const amount = parseInt(args[1]);

    // Validate amount
    if (isNaN(amount) || amount < 0) {
      return embeds.deny(message, 'Please provide a valid positive number for the bank limit.');
    }

    // Set reasonable limits (optional safety check)
    if (amount > 100000000) { // 100 million max
      return embeds.deny(message, 'Bank limit cannot exceed 100,000,000.');
    }

    // Ensure user data exists in the database
    await ensureUserData(targetUser.id);

    try {
      const userService = getService('user');
      
      // Get current user data to show before/after
      const userData = await userService.ensureUserData(targetUser.id);
      const currentLimit = userData.Gambling?.bankLimit || 50000;
      const currentBank = userData.Gambling?.bank || 0;

      // Update the bank limit
      const success = await userService.updateBankLimit(targetUser.id, amount);

      if (!success) {
        return embeds.deny(message, 'Failed to update bank limit. Please try again.');
      }

      const username = targetMember ? targetMember.displayName : targetUser.username;

      // Create success embed
      const embed = embeds.createSuccess(message, 
        `Bank limit updated for **${username}**!\n\n` +
        `**Previous limit:** ${formatCurrency(currentLimit)}\n` +
        `**New limit:** ${formatCurrency(amount)}\n` +
        `**Current bank balance:** ${formatCurrency(currentBank)}\n\n` +
        `${currentBank > amount ? '⚠️ **Warning:** Current bank balance exceeds new limit!' : '✅ Bank balance is within the new limit.'}`
      );

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in banklimit command:', error);
      return embeds.deny(message, `An error occurred while updating bank limit: ${error.message}`);
    }
  }
};