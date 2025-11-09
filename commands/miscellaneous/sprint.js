const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { autoEndSprint, sendSprintReminder } = require('../../events/system/backgroundTasks');
const logger = require('../../utils/logger');

// Helper functions to work with sprints in Guild model
async function getGuildWithSprints(guildId) {
  const { getModels } = require('../../database');
  const models = getModels();
  if (!models || !models.Guild) return null;
  
  return await models.Guild.findOne({ GuildID: guildId });
}

async function findActiveSprint(guildId) {
  const guildData = await getGuildWithSprints(guildId);
  if (!guildData) return null;
  
  return guildData.Sprints.find(s => s.isActive);
}

async function createSprint(guildId, sprintData) {
  const { getModels } = require('../../database');
  const models = getModels();
  if (!models || !models.Guild) return null;
  
  const guildData = await models.Guild.findOne({ GuildID: guildId });
  if (!guildData) return null;
  
  guildData.Sprints.push(sprintData);
  await guildData.save();
  
  return guildData.Sprints[guildData.Sprints.length - 1];
}

module.exports = {
  name: "sprint",
  aliases: [],
  description: 'Manage reading sprints',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['start', 'end', 'join', 'leave', 'update', 'flow', 'leaderboard', 'history'].includes(subcommand)) {
      return runHelpCommand(message, 'sprint');
    }

    switch (subcommand) {
      case 'start': {
        const subcommandInfo = {
          description: 'Start a new reading sprint',
          usage: '{guildprefix}sprint start [duration] [name]',
          aliases: [],
          parameters: ['duration', 'name (optional)'],
          example: '{guildprefix}sprint start 30m Reading Session'
        };
        return await startSprint(client, message, args.slice(1));
      }
      case 'end': {
        const subcommandInfo = {
          description: 'End the current sprint',
          usage: '{guildprefix}sprint end',
          aliases: [],
          parameters: [],
          example: '{guildprefix}sprint end'
        };
        return await endSprint(client, message);
      }
      case 'join': {
        const subcommandInfo = {
          description: 'Join the current sprint',
          usage: '{guildprefix}sprint join [book name], [start page]',
          aliases: [],
          parameters: ['book name', 'start page'],
          example: '{guildprefix}sprint join Harry Potter, 150'
        };
        return await joinSprint(client, message, args.slice(1));
      }
      case 'leave': {
        const subcommandInfo = {
          description: 'Leave the current sprint',
          usage: '{guildprefix}sprint leave',
          aliases: [],
          parameters: [],
          example: '{guildprefix}sprint leave'
        };
        return await leaveSprint(client, message);
      }
      case 'update': {
        const subcommandInfo = {
          description: 'Update your current page',
          usage: '{guildprefix}sprint update [page number]',
          aliases: [],
          parameters: ['page number'],
          example: '{guildprefix}sprint update 175'
        };
        return await updateSprint(client, message, args.slice(1));
      }
      case 'flow': {
        const subcommandInfo = {
          description: 'Pause or resume your time tracking',
          usage: '{guildprefix}sprint flow',
          aliases: [],
          parameters: [],
          example: '{guildprefix}sprint flow'
        };
        return await toggleFlow(client, message);
      }
      case 'leaderboard': {
        const subcommandInfo = {
          description: 'Show sprint leaderboard',
          usage: '{guildprefix}sprint leaderboard',
          aliases: [],
          parameters: [],
          example: '{guildprefix}sprint leaderboard'
        };
        return await showLeaderboard(client, message);
      }
      case 'history': {
        const subcommandInfo = {
          description: 'Show your sprint history',
          usage: '{guildprefix}sprint history',
          aliases: [],
          parameters: [],
          example: '{guildprefix}sprint history'
        };
        return await showHistory(client, message);
      }
      default:
        return runHelpCommand(message, 'sprint');
    }
  }
};

/**
 * Start a new reading sprint
 */
async function startSprint(client, message, args) {
  try {
    // Check if there's already an active sprint
    const existingSprint = await findActiveSprint(message.guild.id);

    if (existingSprint) {
      return embeds.warn(message, 'There is already an active **reading sprint** in this server!');
    }

    // Parse duration (default 24h) and optional role
    let duration = '24h';
    let roleId = null;

    if (args[0]) {
      // Check if first arg is duration format
      if (/^\d+[hdm]$/.test(args[0])) {
        duration = args[0];

        // Check for role in second arg
        if (args[1]) {
          const { findRole } = require('../../handlers/finder');
          const roleResult = findRole(message.guild, args[1]);
          if (roleResult.found) {
            roleId = roleResult.role.id;
          }
        }
      }
    }

    // Parse duration to milliseconds
    const durationMs = parseDuration(duration);
    if (!durationMs) {
      return embeds.warn(message, 'Invalid duration format. Use format like: `30m`, `2h`, `7d`');
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMs);

    // Create embed
    const embed = createSprintEmbed(null, startTime, endTime, []);

    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('sprint_join')
          .setLabel('Join')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sprint_update')
          .setLabel('Update')
          .setStyle(ButtonStyle.Secondary)
      );

    // Send with role mention if provided
    const messageOptions = { embeds: [embed], components: [row] };
    if (roleId) {
      messageOptions.content = `<@&${roleId}>`;
      messageOptions.allowedMentions = { roles: [roleId] };
    }

    const sentMessage = await message.channel.send(messageOptions);

    // Save sprint to database
    const sprint = await createSprint(message.guild.id, {
      messageId: sentMessage.id,
      channelId: message.channel.id,
      roleId: roleId,
      startTime,
      endTime,
      participants: [],
      isActive: true,
      reminderSent: false,
      createdBy: message.author.id
    });

    // Schedule reminder and auto-end
    scheduleSprintTimers(client, sprint, durationMs);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to start reading sprint. Please try again.');
  }
}

/**
 * End the current sprint
 */
async function endSprint(client, message) {
  try {
    const guildData = await getGuildWithSprints(message.guild.id);
    if (!guildData) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = guildData.Sprints.find(s => s.isActive);

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    // Confirmation
    await createConfirmation(
      message,
      'Are you sure you want to end the current **reading sprint**?',
      async (interaction, confirmMessage) => {
        // End the sprint
        sprint.isActive = false;
        await guildData.save();

        // Save to user history
        await saveSprintHistory(sprint);

        // Update the sprint message
        try {
          const channel = await client.channels.fetch(sprint.channelId);
          const sprintMessage = await channel.messages.fetch(sprint.messageId);

          const endedEmbed = createSprintEndedEmbed(sprint);
          await sprintMessage.edit({ embeds: [endedEmbed], components: [] });
        } catch (err) {
        }

        // Edit confirmation with success
        const successEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(`${config.emojis.success} ${message.author}: Reading sprint has been **ended**!`);

        await interaction.update({ embeds: [successEmbed], components: [] });
      }
    );

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to end reading sprint. Please try again.');
  }
}



/**
 * Create sprint embed
 */
function createSprintEmbed(name, startTime, endTime, participants) {
  const title = name ? `READING SPRINT: ${name.toUpperCase()}` : 'READING SPRINT STARTED!';

  let description = `**Start Time:** <t:${Math.floor(startTime.getTime() / 1000)}:F> (<t:${Math.floor(startTime.getTime() / 1000)}:R>)\n`;
  description += `**End Time:** <t:${Math.floor(endTime.getTime() / 1000)}:F> (<t:${Math.floor(endTime.getTime() / 1000)}:R>)\n\n`;

  if (participants.length === 0) {
    description += '**Present Attendees**\nNo participants yet. Click **Join** to participate!';
  } else {
    description += '**Present Attendees**\n';
    participants.forEach((p, index) => {
      description += `\`${String(index + 1).padStart(2, '0')}\` **${p.username}**: Tab \`${p.currentTab}\` of **${p.bookName}**\n`;
    });
  }

  return new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle(title)
    .setDescription(description);
}

/**
 * Create sprint ended embed
 */
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

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([hdm])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/**
 * Join sprint command
 */
async function joinSprint(client, message, args) {
  try {
    const guildData = await getGuildWithSprints(message.guild.id);
    if (!guildData) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = guildData.Sprints.find(s => s.isActive);

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    // Check if already joined
    if (sprint.participants.some(p => p.userId === message.author.id)) {
      return embeds.warn(message, 'You have already joined this sprint!');
    }

    // Parse arguments: book name, start tab
    const fullArgs = args.join(' ');
    const parts = fullArgs.split(',').map(p => p.trim());

    if (parts.length < 2) {
      return runHelpCommand(message, 'sprint');
    }

    const bookName = parts[0];
    const startTab = parseInt(parts[1]);

    if (!bookName || isNaN(startTab) || startTab < 0) {
      return embeds.warn(message, 'Invalid input. Please provide a valid book name and starting tab number.');
    }

    // Add participant
    sprint.participants.push({
      userId: message.author.id,
      username: message.author.username,
      bookName: bookName,
      startTab: startTab,
      currentTab: startTab,
      joinedAt: new Date(),
      isPaused: false,
      totalPausedTime: 0,
      lastPauseTime: null
    });

    await guildData.save();

    // Update the sprint message
    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);
      const updatedEmbed = createSprintEmbed(null, sprint.startTime, sprint.endTime, sprint.participants);
      await sprintMessage.edit({ embeds: [updatedEmbed] });
    } catch (err) {
    }

    return embeds.success(message, `You have joined the sprint! Reading **${bookName}** starting at tab **${startTab}**.`);

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to join sprint. Please try again.');
  }
}

/**
 * Leave sprint command
 */
async function leaveSprint(client, message) {
  try {
    const guildData = await getGuildWithSprints(message.guild.id);
    if (!guildData) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = guildData.Sprints.find(s => s.isActive);

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    // Check if user is in sprint
    const participantIndex = sprint.participants.findIndex(p => p.userId === message.author.id);
    if (participantIndex === -1) {
      return embeds.warn(message, 'You are not part of the current sprint!');
    }

    // Confirmation
    await createConfirmation(
      message,
      'Are you sure you want to leave the current **reading sprint**?',
      async (interaction, confirmMessage) => {
        // Remove participant
        sprint.participants.splice(participantIndex, 1);
        await guildData.save();

        // Update the sprint message
        try {
          const channel = await client.channels.fetch(sprint.channelId);
          const sprintMessage = await channel.messages.fetch(sprint.messageId);
          const updatedEmbed = createSprintEmbed(null, sprint.startTime, sprint.endTime, sprint.participants);
          await sprintMessage.edit({ embeds: [updatedEmbed] });
        } catch (err) {
        }

        // Edit confirmation with success
        const successEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(`${config.emojis.success} ${message.author}: You have left the reading sprint!`);

        await interaction.update({ embeds: [successEmbed], components: [] });
      }
    );

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to leave sprint. Please try again.');
  }
}

/**
 * Update sprint progress command
 */
async function updateSprint(client, message, args) {
  try {
    const guildData = await getGuildWithSprints(message.guild.id);
    if (!guildData) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = guildData.Sprints.find(s => s.isActive);

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    // Check if user is in sprint
    const participant = sprint.participants.find(p => p.userId === message.author.id);
    if (!participant) {
      return embeds.warn(message, 'You are not part of the current sprint!');
    }

    let currentTab = parseInt(args[0]);
    if (isNaN(currentTab) || currentTab < 0) {
      return runHelpCommand(message, 'sprint');
    }

    // Cap at 9999
    if (currentTab > 9999) {
      currentTab = 9999;
    }

    const oldTab = participant.currentTab;
    participant.currentTab = currentTab;
    await guildData.save();

    // Update the sprint message
    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);
      const updatedEmbed = createSprintEmbed(null, sprint.startTime, sprint.endTime, sprint.participants);
      await sprintMessage.edit({ embeds: [updatedEmbed] });
    } catch (err) {
    }

    // Just react to confirm the update
    await message.react('✅').catch(() => { });

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to update progress. Please try again.');
  }
}

/**
 * Toggle flow (pause/resume time tracking)
 */
async function toggleFlow(client, message) {
  try {
    const guildData = await getGuildWithSprints(message.guild.id);
    if (!guildData) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = guildData.Sprints.find(s => s.isActive);

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    // Check if user is in sprint
    const participant = sprint.participants.find(p => p.userId === message.author.id);
    if (!participant) {
      return embeds.warn(message, 'You are not part of the current sprint!');
    }

    const now = new Date();

    // Initialize fields if they don't exist (for backward compatibility)
    if (participant.isPaused === undefined) participant.isPaused = false;
    if (participant.totalPausedTime === undefined) participant.totalPausedTime = 0;
    if (participant.lastPauseTime === undefined) participant.lastPauseTime = null;

    if (participant.isPaused) {
      // Resume - calculate paused time and add to total
      const pauseDuration = now.getTime() - participant.lastPauseTime.getTime();
      participant.totalPausedTime += pauseDuration;
      participant.isPaused = false;
      participant.lastPauseTime = null;

      await guildData.save();
      return embeds.success(message, 'Time tracking **resumed**! Your timer is now running.');
    } else {
      // Pause - record pause start time
      participant.isPaused = true;
      participant.lastPauseTime = now;

      await guildData.save();
      return embeds.success(message, 'Time tracking **paused**! Use `,sprint flow` again to resume.');
    }

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to toggle flow. Please try again.');
  }
}

/**
 * Calculate active time for a participant
 */
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

/**
 * Format time duration to readable string
 */
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

/**
 * Show sprint leaderboard
 */
async function showLeaderboard(client, message) {
  try {
    const guildData = await getGuildWithSprints(message.guild.id);
    if (!guildData) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = guildData.Sprints.find(s => s.isActive);

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    if (sprint.participants.length === 0) {
      return embeds.warn(message, 'No participants in the current sprint yet!');
    }

    // Calculate progress and sort
    const results = sprint.participants.map(p => {
      const participant = p.toObject ? p.toObject() : p;
      const activeTime = calculateActiveTime(participant);
      return {
        userId: participant.userId,
        username: participant.username,
        bookName: participant.bookName,
        startTab: participant.startTab,
        currentTab: participant.currentTab,
        progress: participant.currentTab - participant.startTab,
        activeTime: activeTime,
        isPaused: participant.isPaused
      };
    }).sort((a, b) => b.progress - a.progress);

    // Find user's position
    const userPosition = results.findIndex(p => p.userId === message.author.id) + 1;

    let description = '';
    const top10 = results.slice(0, 10);

    top10.forEach((p, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`${String(index + 1).padStart(2, '0')}\``;
      const timeStr = formatDuration(p.activeTime);
      const pausedIndicator = p.isPaused ? ' ⏸️' : '';
      description += `${medal} **${p.username}**: \`${p.progress}\` tabs of **${p.bookName}** in \`${timeStr}\`${pausedIndicator}\n`;
    });

    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setTitle('📚 Reading Sprint Leaderboard')
      .setDescription(description);

    if (userPosition > 0) {
      embed.setFooter({ text: `Your position: #${userPosition}` });
    }

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to show leaderboard. Please try again.');
  }
}

/**
 * Show user's sprint history
 */
async function showHistory(client, message) {
  try {
    const { getModels } = require('../../database');
    const models = getModels();
    if (!models || !models.User) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const User = models.User;
    const userData = await User.findOne({ UserID: message.author.id });

    if (!userData || !userData.SprintHistory || userData.SprintHistory.length === 0) {
      return embeds.warn(message, 'You have no sprint history yet!');
    }

    const { createPagination } = require('../../core/buttons');
    const history = userData.SprintHistory.sort((a, b) => b.completedAt - a.completedAt);

    await createPagination(
      message,
      history,
      (items, currentPage, totalPages) => {
        let description = '';
        items.forEach((item, index) => {
          const globalIndex = (currentPage - 1) * 10 + index + 1;
          const timestamp = Math.floor(item.completedAt.getTime() / 1000);
          description += `\`${String(globalIndex).padStart(2, '0')}\` **${item.bookName}** (<t:${timestamp}:D>)\n`;
        });

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setAuthor({
            name: `${message.author.username}'s Sprint History`,
            iconURL: message.author.displayAvatarURL()
          })
          .setDescription(description)
          .setFooter({ text: `You have read a total of ${history.length} books • Page ${currentPage}/${totalPages}` });

        return embed;
      },
      10,
      'Sprint History'
    );

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to show history. Please try again.');
  }
}

/**
 * Save sprint results to user history
 */
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
    logger.webhook.error(error, message);
  }
}

/**
 * Schedule sprint timers (reminder and auto-end)
 */
function scheduleSprintTimers(client, sprint, durationMs) {
  const timeUntilEnd = sprint.endTime.getTime() - Date.now();

  // Calculate reminder time (30 min before end, or 20% of duration if less than 30 min)
  let reminderTime;
  const thirtyMinutes = 30 * 60 * 1000;

  if (durationMs <= thirtyMinutes) {
    // If sprint is 30 min or less, remind at 20% of remaining time
    reminderTime = timeUntilEnd * 0.8;
  } else {
    // Otherwise remind 30 min before end
    reminderTime = timeUntilEnd - thirtyMinutes;
  }

  // Schedule reminder with better error handling
  if (reminderTime > 0) {
    setTimeout(async () => {
      try {
        await sendSprintReminder(client, sprint.guildId, sprint.messageId);
      } catch (error) {
        logger.webhook.error(error, message);
      }
    }, reminderTime);
  }

  // Schedule auto-end with better error handling
  if (timeUntilEnd > 0) {
    setTimeout(async () => {
      try {
        await autoEndSprint(client, sprint.guildId, sprint.messageId);
      } catch (error) {
        logger.webhook.error(error, message);
      }
    }, timeUntilEnd);
  }
}

// Functions moved to sprintManager.js
