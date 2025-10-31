const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { findUser } = require('../../handlers/finder');

module.exports = {
  name: "checkbank",
  description: 'Check raw database bank limit data (dev only)',
  syntax: 'checkbank @user',
  example: 'checkbank @user',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return embeds.warn(message, 'Please specify a user: `checkbank @user`');
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

    try {
      // Get raw database data
      const { User } = require('../../database');
      const UserModel = User;
      
      const rawData = await UserModel.findOne({ UserID: targetUser.id }).lean();
      
      if (!rawData) {
        return embeds.warn(message, 'User not found in database');
      }

      const bankLimit = rawData.Gambling?.bankLimit;
      const bankLimitType = typeof bankLimit;
      const hasField = rawData.Gambling?.hasOwnProperty('bankLimit');

      let description = `**Raw Database Data for ${targetUser.username}:**\n\n`;
      description += `**Bank Limit Value:** \`${bankLimit}\`\n`;
      description += `**Type:** \`${bankLimitType}\`\n`;
      description += `**Field Exists:** \`${hasField}\`\n`;
      description += `**Is Undefined:** \`${bankLimit === undefined}\`\n`;
      description += `**Is Null:** \`${bankLimit === null}\`\n`;
      description += `**Is Number:** \`${typeof bankLimit === 'number'}\`\n`;

      return embeds.info(message, description);
      
    } catch (error) {
      console.error('Error in checkbank command:', error);
      return embeds.deny(message, 'Failed to check database data');
    }
  }
};