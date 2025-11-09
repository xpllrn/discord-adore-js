/**
 * Background Tasks Handler
 * Combines all periodic background checks:
 * - Reminder checking (every minute)
 * - Giveaway checking (every minute)
 * - Sprint management (resume on startup)
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/setup');

module.exports = {
  name: 'cacheReadyComplete',
  once: true,
  async execute(client) {
    // Set up all background checks
    setupReminderCheck(client);
    setupGiveawayCheck(client);
    setupSprintManager(client);
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
    if (!models || !models.User) return;

    const usersWithReminders = await models.User.find({
      'Reminders.0': { $exists: true }
    }).select('UserID Reminders').maxTimeMS(5000);

    if (!usersWithReminders || usersWithReminders.length === 0) return;

    for (const userData of usersWithReminders) {
      try {
        if (!userData || !userData.UserID) continue;

        const userId = userData.UserID;
        const reminders = await userService.getReminders(userId);

        for (const reminder of reminders) {
          if (!reminder || !reminder.nextTrigger || !reminder.content) continue;
          
          const now = new Date();
          if (reminder.nextTrigger <= now) {
            try {
              const user = await client.users.fetch(userId);
              if (user) {
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

                if (reminder.isDaily) {
                  const nextTrigger = new Date(now.getTime() + reminder.duration);
                  await userService.updateReminderNextTrigger(userId, reminder.id, nextTrigger);
                } else {
                  await userService.removeReminder(userId, reminder.id);
                }
              }
            } catch (dmError) {
              await userService.removeReminder(userId, reminder.id);
            }
          }
        }
      } catch (userError) {
        console.error(`Error processing reminders for user ${userData.UserID}:`, userError);
      }
    }
  } catch (error) {
    const now = Date.now();
    if (now - reminderLastErrorTime > ERROR_COOLDOWN) {
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Reminder Check System', {
          command: 'Reminder Check',
          args: 'System Check'
        });
      }
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
    const { getService } = require('@services');
    const guildService = getService('guild');
    const { getModels, isDatabaseReady } = require('../../database');

    const dbStatus = isDatabaseReady();
    if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) return;

    const models = getModels();
    if (!models || !models.Guild) return;

    const guildsWithGiveaways = await models.Guild.find({
      'Giveaways.0': { $exists: true }
    }).select('GuildID Giveaways').maxTimeMS(5000);

    if (!guildsWithGiveaways || guildsWithGiveaways.length === 0) return;

    const now = new Date();

    for (const guildData of guildsWithGiveaways) {
      try {
        if (!guildData || !guildData.GuildID) continue;

        const guildId = guildData.GuildID;
        const giveaways = guildData.Giveaways || [];

        for (const giveaway of giveaways) {
          if (!giveaway || !giveaway.endTime || giveaway.ended) continue;

          if (new Date(giveaway.endTime) <= now) {
            await endGiveaway(client, guildId, giveaway);
          }
        }
      } catch (guildError) {
        console.error(`Error processing giveaways for guild ${guildData.GuildID}:`, guildError);
      }
    }
  } catch (error) {
    const now = Date.now();
    if (now - giveawayLastErrorTime > ERROR_COOLDOWN) {
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Giveaway Check System', {
          command: 'Giveaway Check',
          args: 'System Check'
        });
      }
      giveawayLastErrorTime = now;
    }
  }
}

async function endGiveaway(client, guildId, giveaway) {
  try {
    const { getModels } = require('../../database');
    const models = getModels();
    if (!models || !models.Guild) return;

    // Mark as ended
    await models.Guild.updateOne(
      { GuildID: guildId, 'Giveaways.messageId': giveaway.messageId },
      { $set: { 'Giveaways.$.ended': true } }
    );

    // Select winners
    const winners = selectRandomWinners(giveaway.participants, giveaway.winners);

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
      console.error('Error announcing giveaway winner:', channelError);
    }
  } catch (error) {
    console.error('Error ending giveaway:', error);
  }
}

function selectRandomWinners(participants, count) {
  if (participants.length <= count) return [...participants];
  const shuffled = [...participants].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// ===== SPRINT MANAGEMENT =====

function setupSprintManager(client) {
  // Resume active sprints on startup (after 30 seconds)
  setTimeout(() => resumeActiveSprints(client), 30000);
}

async function resumeActiveSprints(client) {
  try {
    const { getModels } = require('../../database');
    const models = getModels();
    if (!models || !models.Guild) {
      return;
    }

    const Guild = models.Guild;
    
    // Find all guilds with active sprints
    const guildsWithSprints = await Guild.find({ 
      'Sprints.isActive': true 
    }).select('GuildID Sprints');
    
    let totalActiveSprints = 0;
    
    for (const guildData of guildsWithSprints) {
      const activeSprints = guildData.Sprints.filter(s => s.isActive);
      totalActiveSprints += activeSprints.length;
      
      for (const sprint of activeSprints) {
        const now = Date.now();
        const endTime = sprint.endTime.getTime();

        // Check if sprint should have ended
        if (now >= endTime) {
          await autoEndSprint(client, guildData.GuildID, sprint.messageId);
          continue;
        }

        // Schedule remaining timers
        const timeUntilEnd = endTime - now;
        const thirtyMinutes = 30 * 60 * 1000;

        // Schedule reminder if not sent and within 30 minutes
        if (!sprint.reminderSent && timeUntilEnd <= thirtyMinutes) {
          await sendSprintReminder(client, guildData.GuildID, sprint.messageId);
        }

        // Schedule auto-end with better error handling
        if (timeUntilEnd > 0) {
          setTimeout(async () => {
            try {
              await autoEndSprint(client, guildData.GuildID, sprint.messageId);
            } catch (error) {
              console.error('Sprint auto-end error:', error);
            }
          }, timeUntilEnd);
        }
      }
    }
    

  } catch (error) {
    console.error('Sprint manager error:', error);
  }
}

async function autoEndSprint(client, guildId, messageId) {
  try {
    const { getModels } = require('../../database');
    const models = getModels();
    if (!models || !models.Guild) return;

    const Guild = models.Guild;
    const guildData = await Guild.findOne({ GuildID: guildId });
    
    if (!guildData) return;
    
    const sprint = guildData.Sprints.find(s => s.messageId === messageId && s.isActive);
    if (!sprint) return;

    sprint.isActive = false;
    await guildData.save();

    // Save to user history
    await saveSprintHistory(sprint);

    // Create new message with results
    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);

      const endedEmbed = createSprintEndedEmbed(sprint);

      // Create mentions for all participants (hidden in spoiler)
      let content = '';
      if (sprint.participants.length > 0) {
        const mentions = sprint.participants.map(p => `<@${p.userId}>`).join(' ');
        content = `||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||${mentions}`;
      }

      // Reply to the original message with the ended embed
      await sprintMessage.reply({
        content,
        embeds: [endedEmbed],
        allowedMentions: { users: sprint.participants.map(p => p.userId) }
      });

      // Disable buttons on original message but keep the embed unchanged
      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('sprint_join')
            .setLabel('Join')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('sprint_update')
            .setLabel('Update')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      await sprintMessage.edit({ components: [disabledRow] });
    } catch (err) {
      console.error('Sprint auto-end: Could not update message:', err);
    }
  } catch (error) {
    console.error('Sprint auto-end error:', error);
  }
}

async function sendSprintReminder(client, guildId, messageId) {
  try {
    const { getModels } = require('../../database');
    const models = getModels();
    if (!models || !models.Guild) return;

    const Guild = models.Guild;
    const guildData = await Guild.findOne({ GuildID: guildId });
    
    if (!guildData) return;
    
    const sprint = guildData.Sprints.find(s => s.messageId === messageId && s.isActive && !s.reminderSent);
    if (!sprint || sprint.participants.length === 0) return;

    // Mark reminder as sent
    sprint.reminderSent = true;
    await guildData.save();

    // Get channel and message
    const channel = await client.channels.fetch(sprint.channelId);
    const sprintMessage = await channel.messages.fetch(sprint.messageId);

    // Create mentions for all participants
    const mentions = sprint.participants.map(p => `<@${p.userId}>`).join(' ');

    // Send reminder
    await sprintMessage.reply({
      content: `**Hurry up!** ${mentions} The reading sprint is ending soon! ⏰`,
      allowedMentions: { users: sprint.participants.map(p => p.userId) }
    });

  } catch (error) {
    console.error('Sprint reminder error:', error);
  }
}

function createSprintEndedEmbed(sprint) {
  const title = 'READING SPRINT ENDED!';

  let description = `**Start Time:** <t:${Math.floor(sprint.startTime.getTime() / 1000)}:F>\n`;
  description += `**End Time:** <t:${Math.floor(sprint.endTime.getTime() / 1000)}:F>\n\n`;

  if (sprint.participants.length === 0) {
    description += '**Final Results**\nNo participants.';
  } else {
    // Calculate progress for each participant
    const results = sprint.participants.map(p => {
      const participant = p.toObject ? p.toObject() : p;
      const activeTime = calculateActiveTime(participant, sprint.endTime);
      return {
        userId: participant.userId,
        username: participant.username,
        bookName: participant.bookName,
        startTab: participant.startTab,
        currentTab: participant.currentTab,
        progress: participant.currentTab - participant.startTab,
        activeTime: activeTime
      };
    }).sort((a, b) => b.progress - a.progress);

    description += '**Final Leaderboard**\n';
    results.forEach((p, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`${String(index + 1).padStart(2, '0')}\``;
      const timeStr = formatDuration(p.activeTime);
      description += `${medal} **${p.username}**: ${p.progress} tabs of **${p.bookName}** in \`${timeStr}\`\n`;
    });
  }

  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle(title)
    .setDescription(description);
}

function calculateActiveTime(participant, sprintEndTime = null) {
  const now = sprintEndTime || new Date();
  const joinTime = participant.joinedAt.getTime();
  const totalElapsed = now.getTime() - joinTime;

  let totalPaused = participant.totalPausedTime || 0;

  // If currently paused, add current pause duration
  if (participant.isPaused && participant.lastPauseTime) {
    const currentPauseDuration = now.getTime() - participant.lastPauseTime.getTime();
    totalPaused += currentPauseDuration;
  }

  const activeTime = totalElapsed - totalPaused;
  return Math.max(0, activeTime);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} hr${hours !== 1 ? 's' : ''}, ${minutes} min`;
  } else {
    return `${minutes} min`;
  }
}

async function saveSprintHistory(sprint) {
  try {
    const { getModels } = require('../../database');
    const models = getModels();
    if (!models || !models.User) return;

    const User = models.User;

    // Save for each participant
    for (const participant of sprint.participants) {
      const p = participant.toObject ? participant.toObject() : participant;
      const tabsRead = p.currentTab - p.startTab;

      if (tabsRead > 0) {
        await User.updateOne(
          { UserID: p.userId },
          {
            $push: {
              SprintHistory: {
                bookName: p.bookName,
                tabsRead: tabsRead,
                completedAt: new Date(),
                sprintId: sprint._id.toString()
              }
            }
          },
          { upsert: true }
        );
      }
    }
  } catch (error) {
    console.error('Save sprint history error:', error);
  }
}

// Export sprint functions for use in commands
module.exports.resumeActiveSprints = resumeActiveSprints;
module.exports.autoEndSprint = autoEndSprint;
module.exports.sendSprintReminder = sendSprintReminder;
