// Giveaway check handler - runs every minute to check for expired giveaways

// Import required modules at the top level
const { EmbedBuilder } = require('discord.js');
const config = require('../../config/setup');

module.exports = {
  name: 'cacheReadyComplete',
  once: true,
  async execute(client) {
    // Set up giveaway checking
    setupGiveawayCheck(client);
  }
};

// Track last error to prevent spam
let lastErrorTime = 0;
const ERROR_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function setupGiveawayCheck(client) {
  // Run giveaway check every minute (60000 ms)
  setInterval(async () => {
    await checkGiveaways(client);
  }, 60000); // 1 minute

  // Also run immediately on startup (after 30 seconds to allow database to connect)
  setTimeout(() => checkGiveaways(client), 30000);
}

// Helper function to select random winners
function selectRandomWinners(participants, count) {
  if (participants.length <= count) {
    return [...participants];
  }
  
  const shuffled = [...participants].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper function to create giveaway embed
function createGiveawayEmbed(giveaway, guild) {
  const { EmbedBuilder } = require('discord.js');
  const config = require('../../config/setup');
  
  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle(giveaway.title)
    .setDescription(giveaway.description)
    .addFields(
      { name: 'Ends', value: `<t:${Math.floor(new Date(giveaway.endTime).getTime() / 1000)}:R>`, inline: true },
      { name: 'Winners', value: giveaway.winners.toString(), inline: true },
      { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true }
    )
    .setFooter({ text: `${giveaway.participants.length} participants` })
    .setTimestamp();

  if (guild) {
    embed.setAuthor({
      name: guild.name,
      iconURL: guild.iconURL({ dynamic: true })
    });
  }

  if (giveaway.image) {
    embed.setImage(giveaway.image);
  }

  // Add requirements if any
  const requirements = [];
  if (giveaway.requirements.level) {
    requirements.push(`> Must have **level ${giveaway.requirements.level}**`);
  }
  if (giveaway.requirements.roleId) {
    requirements.push(`> Must have <@&${giveaway.requirements.roleId}>`);
  }

  if (requirements.length > 0) {
    embed.addFields({ name: '**Requirements**', value: requirements.join('\n'), inline: false });
  }

  return embed;
}

async function checkGiveaways(client) {
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');
    const { getModels, isDatabaseReady } = require('../../database');

    // Check if database is ready
    const dbStatus = isDatabaseReady();
    if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) {
      console.log('Database not ready for giveaway check, skipping...');
      return;
    }

    // Get models for direct database access when needed
    const models = getModels();
    if (!models || !models.Guild) {
      console.log('Guild model not available for giveaway check, skipping...');
      return;
    }

    // Get all guilds that have active giveaways with timeout
    const guildsWithGiveaways = await models.Guild.find({
      'Giveaways': { 
        $elemMatch: { 
          isActive: true,
          endTime: { $lte: new Date() }
        }
      }
    }).select('GuildID Giveaways').maxTimeMS(5000); // 5 second timeout

    // Check if we got valid data
    if (!guildsWithGiveaways || guildsWithGiveaways.length === 0) {
      return; // No expired giveaways to process
    }

    for (const guildData of guildsWithGiveaways) {
      try {
        // Validate guildData
        if (!guildData || !guildData.GuildID) {
          continue; // Skip invalid guild data
        }

        const guildId = guildData.GuildID;
        const guild = client.guilds.cache.get(guildId);
        
        if (!guild) {
          continue; // Skip if bot is not in guild
        }

        // Get expired giveaways for this guild
        const expiredGiveaways = await guildService.getExpiredGiveaways(guildId);

        for (const giveaway of expiredGiveaways) {
          try {
            // Get the giveaway channel and message
            const channel = guild.channels.cache.get(giveaway.channelId);
            if (!channel) {
              // Channel not found, mark giveaway as ended
              await guildService.endGiveaway(guildId, giveaway.id, []);
              continue;
            }

            let giveawayMessage;
            try {
              giveawayMessage = await channel.messages.fetch(giveaway.messageId);
            } catch (error) {
              // Message not found, mark giveaway as ended
              await guildService.endGiveaway(guildId, giveaway.id, []);
              continue;
            }

            // Select winners
            const winners = selectRandomWinners(giveaway.participants, giveaway.winners);
            
            // End the giveaway in database
            await guildService.endGiveaway(guildId, giveaway.id, winners);

            // Update the giveaway message
            const endedEmbed = createGiveawayEmbed({ ...giveaway, isActive: false, winnerIds: winners }, guild)
              .setColor(config.colors.success)
              .setTitle(`🎉 ${giveaway.title} (ENDED)`);

            if (winners.length > 0) {
              endedEmbed.addFields({ 
                name: 'Winners', 
                value: winners.map(id => `<@${id}>`).join('\n'), 
                inline: false 
              });
            } else {
              endedEmbed.addFields({ 
                name: 'Winners', 
                value: 'No valid participants', 
                inline: false 
              });
            }

            await giveawayMessage.edit({ embeds: [endedEmbed] });

            // Announce winners
            if (winners.length > 0) {
              const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
              await channel.send(`🎉 Congratulations ${winnerMentions}! You won **${giveaway.title}**!`);
            } else {
              await channel.send(`😔 No valid participants for **${giveaway.title}**. No winners selected.`);
            }

          } catch (giveawayError) {
            console.error(`Error processing giveaway ${giveaway.id} in guild ${guildId}:`, giveawayError);
            // Mark giveaway as ended to prevent repeated processing
            await guildService.endGiveaway(guildId, giveaway.id, []);
          }
        }
      } catch (guildError) {
        console.error(`Error processing giveaways for guild ${guildData.GuildID}:`, guildError);
      }
    }
  } catch (error) {
    // Only log errors if we haven't logged recently (prevent spam)
    const now = Date.now();
    if (now - lastErrorTime > ERROR_COOLDOWN) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Giveaway Check System', {
          command: 'Giveaway Check',
          args: 'System Check'
        });
      }
      lastErrorTime = now;
    }
  }
}
