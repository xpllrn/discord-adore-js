const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { findUser } = require('../../handlers/finder');

module.exports = {
  name: "restorebank",
  description: 'Restore a user\'s bank limit to a specific value (dev only)',
  syntax: 'restorebank @user <amount>',
  example: 'restorebank @hiro 100000',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0] || !args[1]) {
      return embeds.deny(message, 'Usage: `restorebank @user <amount>`');
    }

    try {
      // Find the target user
      const userResult = await findUser(message.guild, args[0], client);
      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }

      const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
      const amount = parseInt(args[1]);

      if (isNaN(amount) || amount < 0) {
        return embeds.deny(message, 'Amount must be a valid positive number');
      }

      // Get UserService
      const { getService } = require('@services');
      const userService = getService('user');

      // Get current bank limit
      const currentLimit = await userService.getBankLimit(targetUser.id);
      
      // Update bank limit
      const success = await userService.updateBankLimit(targetUser.id, amount);

      if (success) {
        console.log(`🔧 RESTORED: User ${targetUser.id} bank limit: ${currentLimit} → ${amount}`);
        
        return embeds.success(message, 
          `🔧 **Bank Limit Restored**\n\n` +
          `**User:** ${targetUser.username || targetUser.displayName}\n` +
          `**Previous Limit:** ${currentLimit.toLocaleString()} coins\n` +
          `**New Limit:** ${amount.toLocaleString()} coins\n\n` +
          `✅ Bank limit has been restored successfully!`
        );
      } else {
        return embeds.deny(message, 'Failed to update bank limit');
      }
      
    } catch (error) {
      console.error('Error in restorebank command:', error);
      return embeds.deny(message, `Failed to restore bank limit: ${error.message}`);
    }
  }
};