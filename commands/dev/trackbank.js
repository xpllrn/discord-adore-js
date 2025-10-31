const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');

module.exports = {
  name: "trackbank",
  description: 'Track bank limit changes in real-time (dev only)',
  syntax: 'trackbank @user',
  example: 'trackbank @user',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return embeds.warn(message, 'Please specify a user: `trackbank @user`');
    }

    const { findUser } = require('../../handlers/finder');
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
      
      console.log(`🔍 TRACKING BANK LIMIT FOR USER ${targetUser.id} (${targetUser.username})`);
      
      // Step 1: Check raw database
      const rawData = await UserModel.findOne({ UserID: targetUser.id }).lean();
      console.log(`📊 RAW DB: bankLimit = ${rawData?.Gambling?.bankLimit} (${typeof rawData?.Gambling?.bankLimit})`);
      
      // Step 2: Check UserService cache
      const { getService } = require('@services');
      const userService = getService('user');
      const cachedData = userService.cache.get(targetUser.id);
      console.log(`💾 CACHE: bankLimit = ${cachedData?.Gambling?.bankLimit} (${typeof cachedData?.Gambling?.bankLimit})`);
      
      // Step 3: Call ensureUserData and see what happens
      console.log(`🔧 CALLING ensureUserData...`);
      const ensuredData = await userService.ensureUserData(targetUser.id);
      console.log(`📋 ENSURED: bankLimit = ${ensuredData?.Gambling?.bankLimit} (${typeof ensuredData?.Gambling?.bankLimit})`);
      
      // Step 4: Call getGamblingData and see what happens
      console.log(`🎰 CALLING getGamblingData...`);
      const gamblingData = await userService.getGamblingData(targetUser.id);
      console.log(`🎲 GAMBLING: bankLimit = ${gamblingData?.bankLimit} (${typeof gamblingData?.bankLimit})`);
      
      // Step 5: Call getBankLimit and see what happens
      console.log(`🏦 CALLING getBankLimit...`);
      const bankLimit = await userService.getBankLimit(targetUser.id);
      console.log(`💰 BANKLIMIT: ${bankLimit} (${typeof bankLimit})`);
      
      // Step 6: Check raw database again to see if anything changed
      const rawDataAfter = await UserModel.findOne({ UserID: targetUser.id }).lean();
      console.log(`📊 RAW DB AFTER: bankLimit = ${rawDataAfter?.Gambling?.bankLimit} (${typeof rawDataAfter?.Gambling?.bankLimit})`);
      
      return embeds.success(message, 
        `🔍 **Bank Limit Tracking Complete**\n\n` +
        `**Raw DB Before:** ${rawData?.Gambling?.bankLimit}\n` +
        `**Cache:** ${cachedData?.Gambling?.bankLimit || 'Not cached'}\n` +
        `**ensureUserData:** ${ensuredData?.Gambling?.bankLimit}\n` +
        `**getGamblingData:** ${gamblingData?.bankLimit}\n` +
        `**getBankLimit:** ${bankLimit}\n` +
        `**Raw DB After:** ${rawDataAfter?.Gambling?.bankLimit}\n\n` +
        `Check console for detailed logs.`
      );
      
    } catch (error) {
      console.error('Error in trackbank:', error);
      return embeds.deny(message, `Tracking failed: ${error.message}`);
    }
  }
};