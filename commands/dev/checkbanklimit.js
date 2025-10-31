const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');

module.exports = {
  name: "checkbanklimit",
  description: 'Check the status of bankLimit values in the database (dev only)',
  syntax: 'checkbanklimit',
  example: 'checkbanklimit',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    try {
      const { User } = require('../../database');
      const UserModel = User;

      console.log('🔍 Checking bankLimit status...');

      // Count total users
      const totalUsers = await UserModel.countDocuments();

      // Count users with valid bankLimit
      const validBankLimit = await UserModel.countDocuments({
        'Gambling.bankLimit': { $type: 'number' }
      });

      // Count users with missing bankLimit field
      const missingBankLimit = await UserModel.countDocuments({
        'Gambling.bankLimit': { $exists: false }
      });

      // Count users with null bankLimit
      const nullBankLimit = await UserModel.countDocuments({
        'Gambling.bankLimit': null
      });

      // Count users with undefined bankLimit (this might not work as expected in MongoDB)
      const undefinedBankLimit = await UserModel.countDocuments({
        'Gambling.bankLimit': { $type: 'undefined' }
      });

      // Count users with non-number bankLimit
      const invalidTypeBankLimit = await UserModel.countDocuments({
        'Gambling.bankLimit': { $exists: true, $not: { $type: 'number' } }
      });

      // Get a sample of users with issues
      const sampleProblematicUsers = await UserModel.find({
        $or: [
          { 'Gambling.bankLimit': { $exists: false } },
          { 'Gambling.bankLimit': null },
          { 'Gambling.bankLimit': { $not: { $type: 'number' } } }
        ]
      }).limit(3).lean();

      // Get a sample of valid users
      const sampleValidUsers = await UserModel.find({
        'Gambling.bankLimit': { $type: 'number' }
      }).limit(3).lean();

      console.log(`📊 Total users: ${totalUsers}`);
      console.log(`✅ Valid bankLimit: ${validBankLimit}`);
      console.log(`❌ Missing bankLimit: ${missingBankLimit}`);
      console.log(`❌ Null bankLimit: ${nullBankLimit}`);
      console.log(`❌ Undefined bankLimit: ${undefinedBankLimit}`);
      console.log(`❌ Invalid type bankLimit: ${invalidTypeBankLimit}`);

      let description = `📊 **BankLimit Database Status**\n\n`;
      description += `**Total Users:** ${totalUsers}\n`;
      description += `**Valid BankLimit:** ${validBankLimit} ✅\n`;
      description += `**Missing BankLimit:** ${missingBankLimit} ❌\n`;
      description += `**Null BankLimit:** ${nullBankLimit} ❌\n`;
      description += `**Undefined BankLimit:** ${undefinedBankLimit} ❌\n`;
      description += `**Invalid Type BankLimit:** ${invalidTypeBankLimit} ❌\n\n`;

      const totalProblems = missingBankLimit + nullBankLimit + undefinedBankLimit + invalidTypeBankLimit;
      
      if (totalProblems > 0) {
        description += `⚠️ **${totalProblems} users have bankLimit issues**\n\n`;
        description += `**Sample problematic users:**\n`;
        for (const user of sampleProblematicUsers) {
          const bankLimit = user.Gambling?.bankLimit;
          description += `• ${user.UserID}: ${bankLimit} (${typeof bankLimit})\n`;
        }
        description += `\n**Run \`fixbanklimit\` to fix these issues**`;
      } else {
        description += `✅ **All users have valid bankLimit values!**`;
      }

      if (sampleValidUsers.length > 0) {
        description += `\n\n**Sample valid users:**\n`;
        for (const user of sampleValidUsers) {
          const bankLimit = user.Gambling?.bankLimit;
          description += `• ${user.UserID}: ${bankLimit} (${typeof bankLimit})\n`;
        }
      }

      const embed = totalProblems > 0 
        ? embeds.createDeny(message, description)
        : embeds.createSuccess(message, description);

      return message.channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error checking bankLimit status:', error);
      
      const errorEmbed = embeds.createDeny(message, `Failed to check bankLimit status: ${error.message}`);
      return message.channel.send({ embeds: [errorEmbed] });
    }
  }
};