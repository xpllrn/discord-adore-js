const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { createConfirmation } = require('../../../core/buttons');
const config = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

// Helper functions to work with sprints in Guild model
async function getGuildWithSprints(guildId) {
  const { getModels } = require('../../../database');
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
  try {
    const { getModels } = require('../../../database');
    const models = getModels();
    if (!models || !models.Guild) {
      return null;
    }
    
    const guildData = await models.Guild.findOne({ GuildID: guildId });
    if (!guildData) {
      return null;
    }
    
    if (!guildData.Sprints) {
      guildData.Sprints = [];
    }
    
    guildData.Sprints.push(sprintData);
    await guildData.save({ validateBeforeSave: false });
    
    return guildData.Sprints[guildData.Sprints.length - 1];
  } catch (error) {
    logger.webhook.error(error, null);
    throw error;
  }
}

module.exports = {
  name: "sprint",
  aliases: [],
  description: 'Manage reading sprints',
  syntax: 'sprint [subcommand] (parameters)',
  example: 'sprint start 30m Reading Session',
  isGroupCommand: true,

  subcommands: {
    start: {
      name: 'start',
      aliases: ['create'],
      description: 'Start a new reading sprint',
      syntax: '{guildprefix}sprint start [duration] (@role)',
      parameters: ['duration', 'role (optional)'],
      example: '{guildprefix}sprint start 30m @Readers',
      handler: async (client, message, args) => {
        return await startSprint(client, message, args);
      }
    },
    end: {
      name: 'end',
      aliases: ['stop'],
      description: 'End the current sprint',
      syntax: '{guildprefix}sprint end',
      parameters: [],
      example: '{guildprefix}sprint end',
      handler: async (client, message, args) => {
        return await endSprint(client, message);
      }
    },
    join: {
      name: 'join',
      aliases: [],
      description: 'Join the current sprint',
      syntax: '{guildprefix}sprint join [book name], [start page]',
      parameters: ['book name', 'start page'],
      example: '{guildprefix}sprint join Harry Potter, 150',
      handler: async (client, message, args) => {
        return await joinSprint(client, message, args);
      }
    },
    leave: {
      name: 'leave',
      aliases: ['quit'],
      description: 'Leave the current sprint',
      syntax: '{guildprefix}sprint leave',
      parameters: [],
      example: '{guildprefix}sprint leave',
      handler: async (client, message, args) => {
        return await leaveSprint(client, message);
      }
    },
    update: {
      name: 'update',
      aliases: ['progress'],
      description: 'Update your current page',
      syntax: '{guildprefix}sprint update [page number]',
      parameters: ['page number'],
      example: '{guildprefix}sprint update 175',
      handler: async (client, message, args) => {
        return await updateSprint(client, message, args);
      }
    },
    flow: {
      name: 'flow',
      aliases: ['pause', 'resume'],
      description: 'Pause or resume your time tracking',
      syntax: '{guildprefix}sprint flow',
      parameters: [],
      example: '{guildprefix}sprint flow',
      handler: async (client, message, args) => {
        return await toggleFlow(client, message);
      }
    },
    leaderboard: {
      name: 'leaderboard',
      aliases: ['lb'],
      description: 'Show sprint leaderboard',
      syntax: '{guildprefix}sprint leaderboard',
      parameters: [],
      example: '{guildprefix}sprint leaderboard',
      handler: async (client, message, args) => {
        return await showLeaderboard(client, message);
      }
    },
    history: {
      name: 'history',
      aliases: [],
      description: 'Show your sprint history',
      syntax: '{guildprefix}sprint history',
      parameters: [],
      example: '{guildprefix}sprint history',
      handler: async (client, message, args) => {
        return await showHistory(client, message);
      }
    }
  },

  run: async (client, message, args) => {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return runHelpCommand(message, 'sprint');
    }

    const sub = Object.values(module.exports.subcommands)
      .find(s => s.name === subcommand || s.aliases.includes(subcommand));

    if (sub) {
      return sub.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'sprint');
  }
};


/**
 * Start a new reading sprint
 */
async function startSprint(client, message, args) {
  try {
    const existingSprint = await findActiveSprint(message.guild.id);

    if (existingSprint) {
      return embeds.warn(message, 'There is already an active **reading sprint** in this server!');
    }

    let duration = '24h';
    let roleId = null;

    if (args[0]) {
      if (/^\d+[hdm]$/.test(args[0])) {
        duration = args[0];

        if (args[1]) {
          const { findRole } = require('../../../handlers/finder');
          const roleResult = findRole(message.guild, args[1]);
          if (roleResult.found) {
            roleId = roleResult.role.id;
          }
        }
      }
    }

    const durationMs = parseDuration(duration);
    if (!durationMs) {
      return embeds.warn(message, 'Invalid duration format. Use format like: `30m`, `2h`, `7d`');
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMs);

    const embed = createSprintEmbed(null, startTime, endTime, []);

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

    const messageOptions = { embeds: [embed], components: [row] };
    if (roleId) {
      messageOptions.content = `<@&${roleId}>`;
      messageOptions.allowedMentions = { roles: [roleId] };
    }

    const sentMessage = await message.channel.send(messageOptions);

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

    if (!sprint) {
      return embeds.warn(message, 'Failed to create sprint. Please try again.');
    }

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

    await createConfirmation(
      message,
      'Are you sure you want to end the current **reading sprint**?',
      async (interaction, confirmMessage) => {
        sprint.isActive = false;
        await guildData.save({ validateBeforeSave: false });

        await saveSprintHistory(sprint);

        try {
          const channel = await client.channels.fetch(sprint.channelId);
          const sprintMessage = await channel.messages.fetch(sprint.messageId);

          const endedEmbed = createSprintEndedEmbed(sprint);
          await sprintMessage.edit({ embeds: [endedEmbed], components: [] });
        } catch (err) {}

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

    if (sprint.participants.some(p => p.userId === message.author.id)) {
      return embeds.warn(message, 'You have already joined this sprint!');
    }

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

    await guildData.save({ validateBeforeSave: false });

    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);
      const updatedEmbed = createSprintEmbed(null, sprint.startTime, sprint.endTime, sprint.participants);
      await sprintMessage.edit({ embeds: [updatedEmbed] });
    } catch (err) {}

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

    const participantIndex = sprint.participants.findIndex(p => p.userId === message.author.id);
    if (participantIndex === -1) {
      return embeds.warn(message, 'You are not part of the current sprint!');
    }

    await createConfirmation(
      message,
      'Are you sure you want to leave the current **reading sprint**?',
      async (interaction, confirmMessage) => {
        sprint.participants.splice(participantIndex, 1);
        await guildData.save({ validateBeforeSave: false });

        try {
          const channel = await client.channels.fetch(sprint.channelId);
          const sprintMessage = await channel.messages.fetch(sprint.messageId);
          const updatedEmbed = createSprintEmbed(null, sprint.startTime, sprint.endTime, sprint.participants);
          await sprintMessage.edit({ embeds: [updatedEmbed] });
        } catch (err) {}

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

    const participant = sprint.participants.find(p => p.userId === message.author.id);
    if (!participant) {
      return embeds.warn(message, 'You are not part of the current sprint!');
    }

    let currentTab = parseInt(args[0]);
    if (isNaN(currentTab) || currentTab < 0) {
      return runHelpCommand(message, 'sprint');
    }

    if (currentTab > 9999) {
      currentTab = 9999;
    }

    participant.currentTab = currentTab;
    await guildData.save({ validateBeforeSave: false });

    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);
      const updatedEmbed = createSprintEmbed(null, sprint.startTime, sprint.endTime, sprint.participants);
      await sprintMessage.edit({ embeds: [updatedEmbed] });
    } catch (err) {}

    await message.react('✅').catch(() => {});

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

    const participant = sprint.participants.find(p => p.userId === message.author.id);
    if (!participant) {
      return embeds.warn(message, 'You are not part of the current sprint!');
    }

    const now = new Date();

    if (participant.isPaused === undefined) participant.isPaused = false;
    if (participant.totalPausedTime === undefined) participant.totalPausedTime = 0;
    if (participant.lastPauseTime === undefined) participant.lastPauseTime = null;

    if (participant.isPaused) {
      const pauseDuration = now.getTime() - participant.lastPauseTime.getTime();
      participant.totalPausedTime += pauseDuration;
      participant.isPaused = false;
      participant.lastPauseTime = null;

      await guildData.save({ validateBeforeSave: false });
      return embeds.success(message, 'Time tracking **resumed**! Your timer is now running.');
    } else {
      participant.isPaused = true;
      participant.lastPauseTime = now;

      await guildData.save({ validateBeforeSave: false });
      return embeds.success(message, 'Time tracking **paused**! Use `,sprint flow` again to resume.');
    }

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, 'Failed to toggle flow. Please try again.');
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
    const { getModels } = require('../../../database');
    const models = getModels();
    if (!models || !models.User) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const User = models.User;
    const userData = await User.findOne({ UserID: message.author.id });

    if (!userData || !userData.SprintHistory || userData.SprintHistory.length === 0) {
      return embeds.warn(message, 'You have no sprint history yet!');
    }

    const { createPagination } = require('../../../core/buttons');
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
    const { getModels } = require('../../../database');
    const models = getModels();
    if (!models || !models.User) return;

    const User = models.User;

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
                sprintId: sprint._id?.toString() || null
              }
            }
          },
          { upsert: true }
        );
      }
    }
  } catch (error) {
    logger.webhook.error(error);
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
 * Calculate active time for a participant
 */
function calculateActiveTime(participant, sprintEndTime = null) {
  const now = sprintEndTime || new Date();
  const joinTime = participant.joinedAt.getTime();
  const totalElapsed = now.getTime() - joinTime;

  let totalPaused = participant.totalPausedTime || 0;

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
