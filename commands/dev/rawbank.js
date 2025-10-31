const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { findUser } = require('../../handlers/finder');

function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "rawbank",
  description: 'Set bank limit directly in database (dev only)',
  syntax: 'rawbank @user <amount>',
  example: 'rawbank @user 150000',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0] || !args[1]) {
      return embeds.warn(message, 'Usage: `rawbank @user <amount>`');
    }

    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.warn(message, userResult.error || 'User not found');
    }

    let targetUser;
    if (userResult.isGlobal) {
      targetUser = userResult.user;
    } else {
      targetUser = userResult.user.user || userResult.user;
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 0) {
      return embeds.deny(message, 'Please provide a valid positive number');
    }

    try {
      // Set bank limit directly in database
      const { User } = require('../../database');
      const UserModel = User;
      
      const result = await UserModel.updateOne(
        { UserID: targetUser.id },
        { $set: { 'Gambling.bankLimit': amount } },
        { upsert: true }
      );

      if (result.modifiedCount > 0 || result.upsertedCount > 0) {
        return embeds.success(message, 
          `**Direct database update successful**\n\n` +
          `**User:** ${targetUser.username}\n` +
          `**New Bank Limit:** ${formatCurrency(amount)} coins\n` +
          `**Modified:** ${result.modifiedCount} documents\n` +
          `**Upserted:** ${result.upsertedCount} documents`
        );
      } else {
        return embeds.warn(message, 'No documents were modified');
      }
      
    } catch (error) {
      console.error('Error in rawbank command:', error);
      return embeds.deny(message, 'Failed to update database directly');
    }
  }
};