const { Routes } = require('discord.js');
const { embeds } = require('../../core/embeds');
const logger = require('../../utils/logger');

module.exports = {
  name: "resetcustomize",
  aliases: ['resetcustom', 'resetprofile'],
  description: 'Reset the bot\'s server profile (avatar, banner, bio) to default in all servers',
  permission: "Bot Owner",
  
  run: async (client, message, args) => {
    
    // Check if user is bot owner
    const botOwners = process.env.BOT_OWNERS?.split(',') || [process.env.DEV_ID];
    if (!botOwners.includes(message.author.id)) {
      return embeds.deny(message, 'Only the **bot owner** can use this command');
    }

    // Confirmation check
    const confirmArg = args[0]?.toLowerCase();
    if (confirmArg !== 'confirm') {
      return embeds.warn(message, 
        'This will reset the bot\'s profile (avatar, banner, bio) to default in **all servers**.\n\n' +
        `To confirm, use: \`resetcustomize confirm\``
      );
    }

    const statusMsg = await message.channel.send({ 
      embeds: [embeds.normal(message, '⏳ Resetting server profiles...').data] 
    });

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

    await statusMsg.edit({ 
      embeds: [embeds.success(message, resultMessage).data] 
    });
  }
};
