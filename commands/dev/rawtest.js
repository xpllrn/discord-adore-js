const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');

module.exports = {
  name: "rawtest",
  description: 'Test raw database access without destroying existing data (dev only)',
  syntax: 'rawtest @user',
  example: 'rawtest @user',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    try {
      // Get the User model directly
      const { User } = require('../../database');
      const UserModel = User;

      // Use a dedicated test user ID that won't interfere with real users
      const testUserId = 'rawtest_user_12345';
      
      console.log('🧪 RAW DATABASE TEST STARTING');
      
      // Delete existing test document (only the dedicated test user)
      await UserModel.deleteOne({ UserID: testUserId });
      console.log('🗑️ Deleted existing test user document');

      // Create fresh document with explicit values
      const freshDoc = {
        UserID: testUserId,
        Gambling: {
          wallet: 1000,
          bank: 0,
          bankLimit: 50000
        }
      };

      const insertResult = await UserModel.create(freshDoc);
      console.log('✅ Created fresh test document');
      console.log('📝 Inserted bankLimit:', insertResult.Gambling.bankLimit, typeof insertResult.Gambling.bankLimit);

      // Read it back immediately
      const readResult = await UserModel.findOne({ UserID: testUserId }).lean();
      console.log('📖 Read back bankLimit:', readResult?.Gambling?.bankLimit, typeof readResult?.Gambling?.bankLimit);

      // Test with UserService
      const { getService } = require('@services');
      const userService = getService('user');
      
      const serviceResult = await userService.getBankLimit(testUserId);
      console.log('🔧 UserService bankLimit:', serviceResult, typeof serviceResult);

      const gamblingData = await userService.getGamblingData(testUserId);
      console.log('🎰 UserService gambling bankLimit:', gamblingData.bankLimit, typeof gamblingData.bankLimit);

      // Now test the actual user's data (non-destructive)
      const actualUserId = message.author.id;
      const actualUserResult = await userService.getBankLimit(actualUserId);
      const actualGamblingData = await userService.getGamblingData(actualUserId);
      
      console.log('👤 Actual user bankLimit:', actualUserResult, typeof actualUserResult);
      console.log('👤 Actual user gambling bankLimit:', actualGamblingData.bankLimit, typeof actualGamblingData.bankLimit);

      // Clean up test user
      await UserModel.deleteOne({ UserID: testUserId });
      console.log('🧹 Cleaned up test user document');

      return embeds.success(message, 
        `🧪 **Raw Database Test Complete**\n\n` +
        `**Test User Results:**\n` +
        `**Direct Insert:** ${insertResult.Gambling.bankLimit} (${typeof insertResult.Gambling.bankLimit})\n` +
        `**Direct Read:** ${readResult?.Gambling?.bankLimit} (${typeof readResult?.Gambling?.bankLimit})\n` +
        `**UserService getBankLimit:** ${serviceResult} (${typeof serviceResult})\n` +
        `**UserService getGamblingData:** ${gamblingData.bankLimit} (${typeof gamblingData.bankLimit})\n\n` +
        `**Your Actual Data:**\n` +
        `**Your BankLimit:** ${actualUserResult} (${typeof actualUserResult})\n` +
        `**Your Gambling BankLimit:** ${actualGamblingData.bankLimit} (${typeof actualGamblingData.bankLimit})\n\n` +
        `Check console for detailed logs.`
      );
      
    } catch (error) {
      console.error('Error in raw test:', error);
      return embeds.deny(message, `Raw test failed: ${error.message}`);
    }
  }
};