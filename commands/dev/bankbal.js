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
  name: "bankbal",
  description: 'Set user bank balance directly (dev only)',
  syntax: 'bankbal @user <amount>',
  example: 'bankbal @hiro 50000',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0] || !args[1]) {
      return embeds.deny(message, 'Usage: `bankbal @user <amount>`');
    }

    // Find user
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.deny(message, userResult.error || 'User not found');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    const username = userResult.isGlobal ? targetUser.username : userResult.user.displayName;

    // Parse amount
    const newBankBalance = parseAmount(args[1]);
    if (newBankBalance === null) {
      return embeds.deny(message, 'Please provide a valid amount');
    }

    try {
      const userService = getService('user');
      
      // Get current data
      const gambling = await userService.getGamblingData(targetUser.id);
      const currentBankBalance = gambling.bank || 0;
      const bankLimit = await userService.getBankLimit(targetUser.id);

      // Check if new balance exceeds bank limit
      if (newBankBalance > bankLimit) {
        return embeds.deny(message, 
          `Bank balance (${formatCurrency(newBankBalance)}) cannot exceed bank limit (${formatCurrency(bankLimit)})\n\n` +
          `Use \`banklimit @user <amount>\` to increase the bank limit first.`
        );
      }

      // Update user data
      const userData = await userService.ensureUserData(targetUser.id);
      if (!userData.Gambling) {
        userData.Gambling = userService.getDefaultGamblingData();
      }
      
      userData.Gambling.bank = newBankBalance;
      await userService.set(targetUser.id, userData);

      return embeds.success(message, 
        `Successfully updated bank balance for **${username}**\n\n` +
        `**Previous Balance:** ${formatCurrency(currentBankBalance)} coins\n` +
        `**New Balance:** ${formatCurrency(newBankBalance)} coins\n` +
        `**Bank Limit:** ${formatCurrency(bankLimit)} coins`
      );
      
    } catch (error) {
      console.error('Error updating bank balance:', error);
      return embeds.deny(message, 'Failed to update bank balance');
    }
  }
};