const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { findUser } = require('../../handlers/finder');
const { getService } = require('@services');

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
  description: 'Set user bank limit (dev only)',
  syntax: 'banklimit @user <amount>',
  example: 'banklimit @hiro 100000',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0] || !args[1]) {
      return embeds.deny(message, 'Usage: `banklimit @user <amount>`');
    }

    // Find user
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.deny(message, userResult.error || 'User not found');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    const username = userResult.isGlobal ? targetUser.username : userResult.user.displayName;

    // Parse amount
    const newLimit = parseAmount(args[1]);
    if (newLimit === null) {
      return embeds.deny(message, 'Please provide a valid amount');
    }

    if (newLimit > 100000000) {
      return embeds.deny(message, 'Bank limit cannot exceed 100,000,000 coins');
    }

    try {
      const userService = getService('user');
      const currentLimit = await userService.getBankLimit(targetUser.id);
      
      // Update bank limit
      const success = await userService.updateBankLimit(targetUser.id, newLimit);
      
      if (success) {
        return embeds.success(message, 
          `Successfully updated bank limit for **${username}**\n\n` +
          `**Previous Limit:** ${formatCurrency(currentLimit)} coins\n` +
          `**New Limit:** ${formatCurrency(newLimit)} coins`
        );
      } else {
        return embeds.deny(message, 'Failed to update bank limit');
      }
    } catch (error) {
      console.error('Error updating bank limit:', error);
      return embeds.deny(message, 'Failed to update bank limit');
    }
  }
};