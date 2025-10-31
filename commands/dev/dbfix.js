const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { createConfirmation } = require('../../core/buttons');

module.exports = {
  name: "dbfix",
  description: 'EXTREME NUCLEAR: Drop all gambling data and recreate from scratch (dev only)',
  syntax: 'dbfix',
  example: 'dbfix',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission
    if (!await hasPermissionLevel(message, 'dev')) return;

    await createConfirmation(
      message,
      `💥 **EXTREME NUCLEAR OPTION - DATABASE RECONSTRUCTION** 💥\n\n**THIS IS THE MOST EXTREME OPTION POSSIBLE**\n\n**What this does:**\n• Completely drops ALL user documents from the database\n• Recreates ONLY users who are currently in the server\n• Gives everyone fresh, clean gambling data\n• Eliminates ALL data corruption permanently\n\n**⚠️ THIS WILL DELETE EVERYTHING ⚠️**\n• All gambling data gone forever\n• All user preferences gone\n• All notes, reminders, etc. gone\n• Only current server members will be recreated\n\n**This is the nuclear option of nuclear options!**\n\n**Are you absolutely, positively sure?**`,
      async (interaction) => {
        try {
          // Get the User model directly
          const { User } = require('../../database');
          const UserModel = User;
          const { getService } = require('@services');
          const userService = getService('user');

          console.log('💥 STARTING EXTREME NUCLEAR RESET - DROPPING ALL USER DATA');

          // Step 1: Get all current guild members
          const guild = message.guild;
          const members = await guild.members.fetch();
          const memberIds = members.map(member => member.user.id);
          console.log(`👥 Found ${memberIds.length} current guild members`);

          // Step 2: Drop ALL user documents
          const dropResult = await UserModel.deleteMany({});
          console.log(`🗑️ Dropped ${dropResult.deletedCount} user documents completely`);

          // Step 3: Create fresh documents for current members only
          const freshUserData = memberIds.map(userId => ({
            UserID: userId,
            SelfPrefix: null,
            Gambling: {
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
            },
            Inventory: {
              items: []
            },
            LastFMUsername: null,
            LastFMLibrary: {
              artists: [],
              albums: [],
              tracks: []
            },
            LastFMSettings: {},
            Roleplay: {
              given: [],
              received: []
            },
            Notes: [],
            NameHistory: [],
            Birthday: {
              day: null,
              month: null,
              setAt: null
            },
            Timezone: null,
            TicTacToe: {
              wins: 0,
              losses: 0,
              draws: 0
            },
            Reminders: []
          }));

          const insertResult = await UserModel.insertMany(freshUserData);
          console.log(`✅ Created ${insertResult.length} fresh user documents`);

          // Step 4: Clear all caches
          userService.clearCache();
          console.log('🧹 Cleared all service caches');

          // Step 5: Verify the fix worked - check raw database
          const verifyResult = await UserModel.findOne({}).lean();
          console.log(`🔍 RAW Database verification:`);
          console.log(`   - Full Gambling object:`, JSON.stringify(verifyResult?.Gambling, null, 2));
          console.log(`   - bankLimit value: ${verifyResult?.Gambling?.bankLimit}`);
          console.log(`   - bankLimit type: ${typeof verifyResult?.Gambling?.bankLimit}`);

          // Step 6: Count total documents
          const totalCount = await UserModel.countDocuments();
          console.log(`📊 Total user documents in database: ${totalCount}`);

          const successEmbed = embeds.createSuccess(
            message, 
            `💥 **EXTREME NUCLEAR RESET COMPLETE** 💥\n\n**${dropResult.deletedCount}** old user documents dropped\n**${insertResult.length}** fresh user documents created\n**${totalCount}** total documents in database\n\n**All current guild members now have:**\n• **Wallet:** 1,000 coins\n• **Bank:** 0 coins\n• **Bank Limit:** 50,000 coins\n• **All data:** Completely fresh and clean\n\n**🎯 Data corruption should be 100% eliminated**\n**⚠️ Only current server members were recreated**`
          );

          await interaction.editReply({ embeds: [successEmbed], components: [] });
          
        } catch (error) {
          console.error('Error in extreme nuclear reset:', error);
          
          const errorEmbed = embeds.createDeny(message, `Failed to perform extreme nuclear reset: ${error.message}`);
          await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
      }
    );
  }
};