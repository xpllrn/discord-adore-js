const { Routes } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const { hasPermissionLevel } = require('../../utils/permissions');
const logger = require('../../utils/logger');

module.exports = {
  name: "resetcustomize",
  aliases: ['resetcustom', 'resetprofile'],
  description: 'Reset the bot\'s server profile (avatar, banner, bio) to default in all servers',
  permission: 'dev',
  
  run: async (client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    // Show confirmation dialog
    await createConfirmation(
      message,
      'Are you sure you want to **reset** the bot\'s profile (avatar, banner, bio) to default in **all servers**?',
      async (interaction, sentMessage) => {
        // On approve: reset profiles in all servers
        const statusEmbed = embeds.createNormal(message, '⏳ Resetting server profiles...');
        await sentMessage.edit({ embeds: [statusEmbed], components: [] });

        const guilds = client.guilds.cache;
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (const [guildId, guild] of guilds) {
          try {
            console.log(`[RESET CUSTOMIZE] Processing guild: ${guild.name} (${guildId})`);
            
            // Reset avatar, banner, and bio to null (default)
            await client.rest.patch(
              Routes.guildMember(guildId, '@me'),
              {
                body: {
                  avatar: null,
                  banner: null,
                  bio: null
                }
              }
            );

            successCount++;
            console.log(`[RESET CUSTOMIZE] ✓ Successfully reset profile in ${guild.name}`);
            
          } catch (error) {
            failCount++;
            const errorMsg = `${guild.name}: ${error.message}`;
            errors.push(errorMsg);
            console.error(`[RESET CUSTOMIZE] ✗ Failed to reset profile in ${guild.name}:`, error.message);
            logger.webhook.error(error, message);
          }
        }

        // Build result message
        let resultMessage = `**Reset Complete**\n\n`;
        resultMessage += `✅ Successfully reset: **${successCount}** server${successCount !== 1 ? 's' : ''}\n`;
        
        if (failCount > 0) {
          resultMessage += `❌ Failed: **${failCount}** server${failCount !== 1 ? 's' : ''}\n\n`;
          
          if (errors.length > 0) {
            resultMessage += `**Errors:**\n`;
            // Show first 5 errors to avoid message being too long
            const displayErrors = errors.slice(0, 5);
            resultMessage += displayErrors.map(e => `• ${e}`).join('\n');
            
            if (errors.length > 5) {
              resultMessage += `\n*...and ${errors.length - 5} more*`;
            }
          }
        }

        const successEmbed = embeds.createSuccess(message, resultMessage);
        await sentMessage.edit({ embeds: [successEmbed], components: [] });
      }
    );
  }
};
