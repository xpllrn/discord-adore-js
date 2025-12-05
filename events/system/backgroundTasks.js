/**
 * Background Tasks Handler
 * Combines all periodic background checks:
 * - Reminder checking (every minute)
 * - Giveaway checking (every minute)
 * - Sprint management (resume on startup)
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/setup');
const logger = require('../../utils/logger');

module.exports = {
  name: 'cacheReadyComplete',
  once: true,
  async execute(client) {
    // Set up all background checks
    setupReminderCheck(client);
    setupGiveawayCheck(client);
    setupRoleRestoreCleanup(client);
    setupScheduledNukeCheck(client);
    
    // Start cache warming with client
    setupCacheWarming(client);
  }
};

// ===== REMINDER CHECKING =====

let reminderLastErrorTime = 0;
const ERROR_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function setupReminderCheck(client) {
  // Run every minute
  setInterval(async () => {
    await checkReminders(client);
  }, 60000);

  // Initial check after 30 seconds
  setTimeout(() => checkReminders(client), 30000);
}

async function checkReminders(client) {
  try {
    const { getService } = require('@services');
    const userService = getService('user');
    const { getModels, isDatabaseReady } = require('../../database');

    const dbStatus = isDatabaseReady();
    if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) return;

    const models = getModels();
    if (!models?.User) return;

    const usersWithReminders = await models.User.find({
      'Reminders.0': { $exists: true }
    }).select('UserID Reminders').maxTimeMS(5000);

    if (!usersWithReminders?.length) return;

    const now = new Date();

    for (const userData of usersWithReminders) {
      try {
        if (!userData?.UserID) continue;

        const userId = userData.UserID;
        const reminders = await userService.getReminders(userId);

        for (const reminder of reminders) {
          if (!reminder?.nextTrigger || !reminder.content) continue;
          
          // Check if reminder is due
          if (new Date(reminder.nextTrigger) <= now) {
            try {
              const user = await client.users.fetch(userId);
              
              const embed = new EmbedBuilder()
                .setColor(config.colors.embed)
                .setTitle('⏰ Reminder')
                .setDescription(`You wanted me to remind you to: **${reminder.content}**`)
                .setTimestamp(reminder.createdAt);

              const components = [];
              if (reminder.messageUrl) {
                const row = new ActionRowBuilder()
                  .addComponents(
                    new ButtonBuilder()
                      .setLabel('Message')
                      .setStyle(ButtonStyle.Link)
                      .setURL(reminder.messageUrl)
                  );
                components.push(row);
              }

              await user.send({ embeds: [embed], components });

              // Update or remove reminder based on type
              if (reminder.isDaily) {
                const oneDayInMs = 24 * 60 * 60 * 1000;
                const nextTrigger = new Date(new Date(reminder.nextTrigger).getTime() + oneDayInMs);
                await userService.updateReminderNextTrigger(userId, reminder.id, nextTrigger);
              } else {
                await userService.removeReminder(userId, reminder.id);
              }
            } catch (dmError) {
              // If DM fails, remove the reminder
              await userService.removeReminder(userId, reminder.id);
            }
          }
        }
      } catch (userError) {
        logger.console.error(`Error processing reminders for user ${userData.UserID}:`, userError);
      }
    }
  } catch (error) {
    const now = Date.now();
    if (now - reminderLastErrorTime > ERROR_COOLDOWN) {
      client?.errorLogger?.log(error, 'Reminder Check System', {
        command: 'Reminder Check',
        args: 'System Check'
      });
      reminderLastErrorTime = now;
    }
  }
}

// ===== GIVEAWAY CHECKING =====

let giveawayLastErrorTime = 0;

function setupGiveawayCheck(client) {
  // Run every minute
  setInterval(async () => {
    await checkGiveaways(client);
  }, 60000);

  // Initial check after 30 seconds
  setTimeout(() => checkGiveaways(client), 30000);
}

async function checkGiveaways(client) {
  try {
    const { getModels, isDatabaseReady } = require('../../database');

    const dbStatus = isDatabaseReady();
    if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) return;

    const models = getModels();
    if (!models?.Guild) return;

    const guildsWithGiveaways = await models.Guild.find({
      'Giveaways.0': { $exists: true }
    }).select('GuildID Giveaways').maxTimeMS(5000);

    if (!guildsWithGiveaways?.length) return;

    const now = new Date();

    for (const guildData of guildsWithGiveaways) {
      try {
        if (!guildData?.GuildID) continue;

        const guildId = guildData.GuildID;
        const giveaways = guildData.Giveaways || [];

        for (const giveaway of giveaways) {
          // Skip if no end time, already ended, or not active
          if (!giveaway?.endTime || giveaway.ended || giveaway.isActive === false) continue;

          if (new Date(giveaway.endTime) <= now) {
            await endGiveaway(client, guildId, giveaway);
          }
        }
      } catch (guildError) {
        logger.console.error(`Error processing giveaways for guild ${guildData.GuildID}:`, guildError);
      }
    }
  } catch (error) {
    const now = Date.now();
    if (now - giveawayLastErrorTime > ERROR_COOLDOWN) {
      client?.errorLogger?.log(error, 'Giveaway Check System', {
        command: 'Giveaway Check',
        args: 'System Check'
      });
      giveawayLastErrorTime = now;
    }
  }
}

async function endGiveaway(client, guildId, giveaway) {
  try {
    const { getModels } = require('../../database');
    const models = getModels();
    if (!models?.Guild) return;

    // Mark as ended first to prevent duplicate processing
    const result = await models.Guild.updateOne(
      { GuildID: guildId, 'Giveaways.messageId': giveaway.messageId, 'Giveaways.ended': { $ne: true } },
      { $set: { 'Giveaways.$.ended': true, 'Giveaways.$.isActive': false } }
    );

    // If no document was modified, giveaway was already ended
    if (result.modifiedCount === 0) return;

    // Select winners
    const winners = selectRandomWinners(giveaway.participants || [], giveaway.winners);

    // Send winner announcement
    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      const message = await channel.messages.fetch(giveaway.messageId);

      const winnerMentions = winners.length > 0 
        ? winners.map(w => `<@${w}>`).join(', ')
        : 'No valid participants';

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('🎉 Giveaway Ended!')
        .setDescription(giveaway.title)
        .addFields(
          { name: 'Winners', value: winnerMentions, inline: false },
          { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true }
        )
        .setTimestamp();

      await message.edit({ embeds: [embed], components: [] });

      if (winners.length > 0) {
        await channel.send(`Congratulations ${winnerMentions}! You won **${giveaway.title}**!`);
      }
    } catch (channelError) {
      // Silently handle deleted messages/channels/missing access
      // 10008 = Unknown Message, 10003 = Unknown Channel, 50001 = Missing Access
      if (channelError.code === 10008 || channelError.code === 10003 || channelError.code === 50001) {
        // Message or channel was deleted/inaccessible, giveaway is already marked as ended, nothing more to do
        return;
      }
      logger.webhook.error(channelError);
    }
  } catch (error) {
    logger.webhook.error(error);
  }
}

function selectRandomWinners(participants, count) {
  if (!participants?.length) return [];
  if (participants.length <= count) return [...participants];
  
  // Fisher-Yates shuffle (proper random shuffle)
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
}

// ===== ROLE RESTORE CLEANUP =====

let roleRestoreLastErrorTime = 0;

function setupRoleRestoreCleanup(client) {
  // Run every 30 minutes
  setInterval(async () => {
    await cleanupExpiredRoleRestore(client);
  }, 30 * 60 * 1000);

  // Initial check after 1 minute
  setTimeout(() => cleanupExpiredRoleRestore(client), 60000);
}

async function cleanupExpiredRoleRestore(client) {
  try {
    const { getModels, isDatabaseReady } = require('../../database');

    const dbStatus = isDatabaseReady();
    if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) return;

    const models = getModels();
    if (!models?.Guild) return;

    const now = new Date();

    // Remove expired role restore data from all guilds
    const result = await models.Guild.updateMany(
      { 'RoleRestore.0': { $exists: true } },
      { $pull: { RoleRestore: { expiresAt: { $lte: now } } } }
    );

    // Silent cleanup - no need to log
  } catch (error) {
    const now = Date.now();
    if (now - roleRestoreLastErrorTime > ERROR_COOLDOWN) {
      client?.errorLogger?.log(error, 'Role Restore Cleanup System', {
        command: 'Role Restore Cleanup',
        args: 'System Check'
      });
      roleRestoreLastErrorTime = now;
    }
  }
}

// ===== SCHEDULED NUKE CHECKING =====

let scheduledNukeLastErrorTime = 0;

function setupScheduledNukeCheck(client) {
  // Run every minute
  setInterval(async () => {
    await checkScheduledNukes(client);
  }, 60000);

  // Initial check after 45 seconds
  setTimeout(() => checkScheduledNukes(client), 45000);
}

async function checkScheduledNukes(client) {
  try {
    const { getModels, isDatabaseReady } = require('../../database');

    const dbStatus = isDatabaseReady();
    if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) return;

    const models = getModels();
    if (!models?.Guild) return;

    const guildsWithScheduledNukes = await models.Guild.find({
      'ScheduledNukes.0': { $exists: true }
    }).select('GuildID ScheduledNukes').maxTimeMS(5000);

    if (!guildsWithScheduledNukes?.length) return;

    const now = new Date();

    for (const guildData of guildsWithScheduledNukes) {
      try {
        if (!guildData?.GuildID) continue;

        const guildId = guildData.GuildID;
        const scheduledNukes = guildData.ScheduledNukes || [];

        for (const scheduledNuke of scheduledNukes) {
          if (!scheduledNuke?.channelId || !scheduledNuke.interval) continue;

          // Calculate next nuke time
          const baseTime = scheduledNuke.lastNuke 
            ? new Date(scheduledNuke.lastNuke) 
            : new Date(scheduledNuke.createdAt);
          const nextNukeTime = new Date(baseTime.getTime() + scheduledNuke.interval);

          if (nextNukeTime <= now) {
            await executeScheduledNuke(client, guildId, scheduledNuke);
          }
        }
      } catch (guildError) {
        logger.console.error(`Error processing scheduled nukes for guild ${guildData.GuildID}:`, guildError);
      }
    }
  } catch (error) {
    const now = Date.now();
    if (now - scheduledNukeLastErrorTime > ERROR_COOLDOWN) {
      client?.errorLogger?.log(error, 'Scheduled Nuke Check System', {
        command: 'Scheduled Nuke Check',
        args: 'System Check'
      });
      scheduledNukeLastErrorTime = now;
    }
  }
}

async function executeScheduledNuke(client, guildId, scheduledNuke) {
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(scheduledNuke.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      // Channel no longer exists, remove the scheduled nuke
      await guildService.removeScheduledNuke(guildId, scheduledNuke.channelId);
      return;
    }

    // Check bot permissions
    const botMember = guild.members.me;
    if (!botMember?.permissions.has('ManageChannels')) return;

    // Store channel data before deletion
    const channelData = {
      name: channel.name,
      type: channel.type,
      topic: channel.topic,
      nsfw: channel.nsfw,
      rateLimitPerUser: channel.rateLimitPerUser,
      rawPosition: channel.rawPosition,
      parent: channel.parent,
      permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield
      }))
    };

    const oldChannelId = channel.id;

    // Get channel-specific settings to preserve
    const welcomeMsg = await guildService.getWelcomeMessageForChannel(guildId, oldChannelId);
    const leaveMsg = await guildService.getLeaveMessageForChannel(guildId, oldChannelId);
    const boostMsg = await guildService.getBoostMessage(guildId, oldChannelId);
    const loggingConfig = await guildService.getLoggingConfigForChannel(guildId, oldChannelId);
    const starboardChannel = await guildService.getStarboardChannel(guildId);
    const levelUpChannel = await guildService.getLevelUpChannel(guildId);
    const countingData = await guildService.getCounting(guildId);

    // Delete the channel
    await channel.delete('Scheduled Nuke');

    // Create new channel with same settings
    const newChannel = await guild.channels.create({
      name: channelData.name,
      type: channelData.type,
      topic: channelData.topic,
      nsfw: channelData.nsfw,
      rateLimitPerUser: channelData.rateLimitPerUser,
      parent: channelData.parent,
      permissionOverwrites: channelData.permissionOverwrites
    });

    // Set the exact position
    await newChannel.setPosition(channelData.rawPosition).catch(() => {});

    // Restore database settings with new channel ID
    if (welcomeMsg) {
      await guildService.removeWelcomeMessage(guildId, oldChannelId);
      await guildService.addWelcomeMessage(guildId, newChannel.id, welcomeMsg.message);
    }

    if (leaveMsg) {
      await guildService.removeLeaveMessage(guildId, oldChannelId);
      await guildService.addLeaveMessage(guildId, newChannel.id, leaveMsg.message);
    }

    if (boostMsg) {
      await guildService.removeBoostMessage(guildId, oldChannelId);
      await guildService.addBoostMessage(guildId, newChannel.id, boostMsg.message);
    }

    if (loggingConfig) {
      await guildService.removeLoggingChannel(guildId, oldChannelId);
      await guildService.setLoggingChannel(
        guildId,
        newChannel.id,
        loggingConfig.webhookUrl,
        loggingConfig.logTypes,
        loggingConfig.createdBy
      );
    }

    if (starboardChannel === oldChannelId) {
      await guildService.setStarboardChannel(guildId, newChannel.id);
    }

    if (levelUpChannel === oldChannelId) {
      await guildService.setLevelUpChannel(guildId, newChannel.id);
    }

    if (countingData && countingData.channelId === oldChannelId) {
      await guildService.setCounting(guildId, {
        ...countingData,
        channelId: newChannel.id
      });
    }

    // Update scheduled nuke with new channel ID and last nuke time
    await guildService.removeScheduledNuke(guildId, oldChannelId);
    await guildService.addScheduledNuke(
      guildId, 
      newChannel.id, 
      scheduledNuke.interval, 
      scheduledNuke.message, 
      scheduledNuke.addedBy
    );
    await guildService.updateScheduledNukeLastRun(guildId, newChannel.id);

    // Send message in the new channel
    const nukeMessage = scheduledNuke.message || 'Channel has been automatically reset.';
    await newChannel.send(nukeMessage);

  } catch (error) {
    logger.console.error(`Error executing scheduled nuke for guild ${guildId}:`, error);
  }
}

// ===== CACHE WARMING =====

function setupCacheWarming(client) {
  try {
    const cacheWarmer = require('../../database/services/core/CacheWarmer');
    const { getService } = require('@services');
    
    const services = {
      system: getService('system'),
      guild: getService('guild'),
      user: getService('user')
    };
    
    // Start cache warmer with client for guild prefixes
    cacheWarmer.start(services, client);
  } catch (error) {
    logger.console.error('Failed to start cache warmer:', error.message);
  }
}
