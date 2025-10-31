const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');

module.exports = {
  name: "fixbanklimit",
  description: 'Fix all users with undefined bankLimit values (dev only)',
  syntax: 'fixbanklimit',
  example: 'fixbanklimit',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    try {
      const { User } = require('../../database');
      const UserModel = User;
      const { getService } = require('@services');
      const userService = getService('user');

      console.log('🔧 Starting bankLimit fix operation...');

      // Step 1: Find users with missing or invalid bankLimit
      const usersWithMissingBankLimit = await UserModel.find({
        $or: [
          { 'Gambling.bankLimit': { $exists: false } },
          { 'Gambling.bankLimit': null },
          { 'Gambling.bankLimit': { $type: 'undefined' } },
          { 'Gambling.bankLimit': { $not: { $type: 'number' } } }
        ]
      });

      console.log(`🔍 Found ${usersWithMissingBankLimit.length} users with missing/invalid bankLimit`);

      if (usersWithMissingBankLimit.length === 0) {
        const successEmbed = embeds.createSuccess(
          message, 
          `✅ **No Issues Found**\n\nAll users already have valid bankLimit values!`
        );
        return message.channel.send({ embeds: [successEmbed] });
      }

      // Step 2: Fix all users with missing bankLimit
      const fixResult = await UserModel.updateMany(
        {
          $or: [
            { 'Gambling.bankLimit': { $exists: false } },
            { 'Gambling.bankLimit': null },
            { 'Gambling.bankLimit': { $type: 'undefined' } },
            { 'Gambling.bankLimit': { $not: { $type: 'number' } } }
          ]
        },
        { $set: { 'Gambling.bankLimit': 50000 } }
      );

      console.log(`✅ Fixed ${fixResult.modifiedCount} users with missing bankLimit`);

      // Step 3: Clear service cache to ensure fresh data
      userService.clearCache();
      console.log('🧹 Cleared service cache');

      // Step 4: Verify the fix worked
      const verifyResult = await UserModel.findOne(
        { UserID: { $exists: true } }, 
        { 'Gambling.bankLimit': 1 }
      );
      console.log(`🔍 Verification: Sample bankLimit = ${verifyResult?.Gambling?.bankLimit} (type: ${typeof verifyResult?.Gambling?.bankLimit})`);

      // Step 5: Count remaining issues
      const remainingIssues = await UserModel.countDocuments({
        $or: [
          { 'Gambling.bankLimit': { $exists: false } },
          { 'Gambling.bankLimit': null },
          { 'Gambling.bankLimit': { $type: 'undefined' } },
          { 'Gambling.bankLimit': { $not: { $type: 'number' } } }
        ]
      });

      const successEmbed = embeds.createSuccess(
        message, 
        `🔧 **BankLimit Fix Complete**\n\n**${usersWithMissingBankLimit.length}** users had missing bankLimit\n**${fixResult.modifiedCount}** users were fixed\n**${remainingIssues}** remaining issues\n\n**All users now have bankLimit: 50,000**\n\n${remainingIssues === 0 ? '✅ **All bankLimit issues resolved!**' : '⚠️ **Some issues may remain - check logs**'}`
      );

      return message.channel.send({ embeds: [successEmbed] });
      
    } catch (error) {
      console.error('Error in bankLimit fix:', error);
      
      const errorEmbed = embeds.createDeny(message, `Failed to fix bankLimit: ${error.message}`);
      return message.channel.send({ embeds: [errorEmbed] });
    }
  }
};