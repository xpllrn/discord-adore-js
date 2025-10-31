const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { createConfirmation } = require('../../core/buttons');

module.exports = {
  name: "resetall",
  description: 'NUCLEAR OPTION: Reset all gambling data globally (dev only)',
  syntax: 'resetall',
  example: 'resetall',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    await createConfirmation(
      message,
      `🚨 **NUCLEAR OPTION - COMPLETE DATA RESET** 🚨\n\n**THIS WILL COMPLETELY WIPE AND RECREATE ALL GAMBLING DATA FOR ALL USERS**\n\n**What this does:**\n• Deletes ALL existing gambling data\n• Recreates fresh gambling data with proper defaults\n• Sets everyone to: 1,000 wallet, 0 bank, 50,000 bank limit\n• Resets all gambling stats to 0\n• Clears all cooldowns\n\n**⚠️ THIS CANNOT BE UNDONE ⚠️**\n**⚠️ ALL GAMBLING PROGRESS WILL BE LOST ⚠️**\n\n**Are you absolutely sure?**`,
      async (interaction) => {
        try {

          // Get the User model directly
          const { User } = require('../../database');
          const UserModel = User;
          const { getService } = require('@services');
          const userService = getService('user');

          console.log('🚨 STARTING NUCLEAR RESET - WIPING ALL GAMBLING DATA');

          // Step 1: Remove ALL gambling data
          const deleteResult = await UserModel.updateMany(
            {},
            { $unset: { 'Gambling': 1 } }
          );
          console.log(`🗑️ Deleted gambling data from ${deleteResult.modifiedCount} users`);

          // Step 2: Create fresh gambling data with proper defaults
          const defaultGamblingData = {
            wallet: 1000,
            bank: 0,
            bankLimit: 50000,
            dailyClaim: {
              lastClaimed: null,
              streak: 0
            },
            robCooldown: null,
            lastWorked: null,
            begCooldown: null,
            lastInterestClaim: null,
            lastVote: null,
            totalVotes: 0,
            totalGambled: 0,
            totalWon: 0,
            totalLost: 0
          };

          const createResult = await UserModel.updateMany(
            {},
            { $set: { 'Gambling': defaultGamblingData } }
          );
          console.log(`✅ Created fresh gambling data for ${createResult.modifiedCount} users`);

          // Step 3: Clear all caches
          userService.clearCache();
          console.log('🧹 Cleared all service caches');

          // Step 4: Verify the reset worked
          const verifyResult = await UserModel.findOne({}, { 'Gambling.bankLimit': 1 });
          console.log(`🔍 Verification: Sample bankLimit = ${verifyResult?.Gambling?.bankLimit}`);

          const successEmbed = embeds.createSuccess(
            message, 
            `🚨 **NUCLEAR RESET COMPLETE** 🚨\n\n**${deleteResult.modifiedCount}** users had gambling data wiped\n**${createResult.modifiedCount}** users got fresh gambling data\n\n**All users now have:**\n• **Wallet:** 1,000 coins\n• **Bank:** 0 coins\n• **Bank Limit:** 50,000 coins\n• **All stats:** Reset to 0\n• **All cooldowns:** Cleared\n\n**✅ Data corruption should be completely eliminated**`
          );

          await interaction.editReply({ embeds: [successEmbed], components: [] });
          
        } catch (error) {
          console.error('Error in nuclear reset:', error);
          
          const errorEmbed = embeds.createDeny(message, `Failed to perform nuclear reset: ${error.message}`);
          await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
      }
    );
  }
};