const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createConfirmation } = require('../../core/buttons');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');

// Get Sprint model from database
function getSprintModel() {
  const { getModels } = require('../../database');
  const models = getModels();
  return models ? models.Sprint : null;
}

module.exports = {
  name: "sprint",
  aliases: [],
  description: 'Manage reading sprints',
  usage: '{guildprefix}sprint start [duration] [name]\n{guildprefix}sprint end\n{guildprefix}sprint join [book name], [start tab]\n{guildprefix}sprint leave\n{guildprefix}sprint update [page number]\n{guildprefix}sprint leaderboard\n{guildprefix}sprint history',
  run: async (client, message, args) => {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['start', 'end', 'join', 'leave', 'update', 'leaderboard', 'history'].includes(subcommand)) {
      return runHelpCommand(message, 'sprint');
    }

    switch (subcommand) {
      case 'start':
        return await startSprint(client, message, args.slice(1));
      case 'end':
        return await endSprint(client, message);
      case 'join':
        return await joinSprint(client, message, args.slice(1));
      case 'leave':
        return await leaveSprint(client, message);
      case 'update':
        return await updateSprint(client, message, args.slice(1));
      case 'leaderboard':
        return await showLeaderboard(client, message);
      case 'history':
        return await showHistory(client, message);
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
    const Sprint = getSprintModel();
    if (!Sprint) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    // Check if there's already an active sprint
    const existingSprint = await Sprint.findOne({
      guildId: message.guild.id,
      isActive: true
    });

    if (existingSprint) {
      return embeds.warn(message, 'There is already an active **reading sprint** in this server!');
    }

    // Parse duration (default 24h)
    let duration = '24h';
    let sprintName = null;

    if (args[0]) {
      // Check if first arg is duration format
      if (/^\d+[hdm]$/.test(args[0])) {
        duration = args[0];
        sprintName = args.slice(1).join(' ') || null;
      } else {
        // First arg is name
        sprintName = args.join(' ');
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
    const embed = createSprintEmbed(sprintName, startTime, endTime, []);

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

    const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

    // Save sprint to database
    await Sprint.create({
      guildId: message.guild.id,
      messageId: sentMessage.id,
      channelId: message.channel.id,
      name: sprintName,
      startTime,
      endTime,
      participants: [],
      isActive: true,
      createdBy: message.author.id
    });

    // Schedule auto-end
    const timeUntilEnd = endTime.getTime() - Date.now();
    if (timeUntilEnd > 0 && timeUntilEnd < 2147483647) { // Max setTimeout value
      setTimeout(async () => {
        await autoEndSprint(client, message.guild.id, sentMessage.id);
      }, timeUntilEnd);
    }

  } catch (error) {
    console.error('[Sprint Start] Error:', error);
    return embeds.warn(message, 'Failed to start reading sprint. Please try again.');
  }
}

/**
 * End the current sprint
 */
async function endSprint(client, message) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = await Sprint.findOne({
      guildId: message.guild.id,
      isActive: true
    });

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
        await sprint.save();

        // Save to user history
        await saveSprintHistory(sprint);

        // Update the sprint message
        try {
          const channel = await client.channels.fetch(sprint.channelId);
          const sprintMessage = await channel.messages.fetch(sprint.messageId);

          const endedEmbed = createSprintEndedEmbed(sprint);
          await sprintMessage.edit({ embeds: [endedEmbed], components: [] });
        } catch (err) {
          console.error('[Sprint End] Could not update message:', err);
        }

        // Edit confirmation with success
        const successEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(`${config.emojis.success} ${message.author}: Reading sprint has been **ended**!`);

        await interaction.update({ embeds: [successEmbed], components: [] });
      }
    );

  } catch (error) {
    console.error('[Sprint End] Error:', error);
    return embeds.warn(message, 'Failed to end reading sprint. Please try again.');
  }
}

/**
 * Auto-end sprint when time expires
 */
async function autoEndSprint(client, guildId, messageId) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) return;

    const sprint = await Sprint.findOne({
      guildId,
      messageId,
      isActive: true
    });

    if (!sprint) return;

    sprint.isActive = false;
    await sprint.save();

    // Save to user history
    await saveSprintHistory(sprint);

    // Update the sprint message
    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);

      const endedEmbed = createSprintEndedEmbed(sprint);
      await sprintMessage.edit({ embeds: [endedEmbed], components: [] });
    } catch (err) {
      console.error('[Sprint Auto-End] Could not update message:', err);
    }
  } catch (error) {
    console.error('[Sprint Auto-End] Error:', error);
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
  const title = sprint.name ? `READING SPRINT ENDED: ${sprint.name.toUpperCase()}` : 'READING SPRINT ENDED!';

  let description = `**Start Time:** <t:${Math.floor(sprint.startTime.getTime() / 1000)}:F>\n`;
  description += `**End Time:** <t:${Math.floor(sprint.endTime.getTime() / 1000)}:F>\n\n`;

  if (sprint.participants.length === 0) {
    description += '**Final Results**\nNo participants.';
  } else {
    // Calculate progress for each participant
    const results = sprint.participants.map(p => {
      const participant = p.toObject ? p.toObject() : p;
      return {
        userId: participant.userId,
        username: participant.username,
        bookName: participant.bookName,
        startTab: participant.startTab,
        currentTab: participant.currentTab,
        progress: participant.currentTab - participant.startTab
      };
    }).sort((a, b) => b.progress - a.progress);

    description += '**Final Leaderboard**\n';
    results.forEach((p, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`${String(index + 1).padStart(2, '0')}\``;
      description += `${medal} **${p.username}**: \`${p.progress}\` tabs (${p.startTab} → ${p.currentTab}) - **${p.bookName}**\n`;
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
    const Sprint = getSprintModel();
    if (!Sprint) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = await Sprint.findOne({
      guildId: message.guild.id,
      isActive: true
    });

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
      return embeds.warn(message, 'Usage: `,sprint join [book name], [start tab]`\nExample: `,sprint join Harry Potter, 22`');
    }

    const bookName = parts[0];
    const startTab = parseInt(parts[1]);

    if (!bookName || isNaN(startTab) || startTab < 0) {
      return embeds.warn(message, 'Invalid input. Please provide a valid book name and starting tab number.');
    }

    // Add participant
    sprint.participants.push({
      userId: message.author.id,
      username: message.author.displayName || message.author.username,
      bookName: bookName,
      startTab: startTab,
      currentTab: startTab,
      joinedAt: new Date()
    });

    await sprint.save();

    // Update the sprint message
    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);
      const updatedEmbed = createSprintEmbed(sprint.name, sprint.startTime, sprint.endTime, sprint.participants);
      await sprintMessage.edit({ embeds: [updatedEmbed] });
    } catch (err) {
      console.error('[Sprint Join] Could not update message:', err);
    }

    return embeds.success(message, `You have joined the sprint! Reading **${bookName}** starting at tab **${startTab}**.`);

  } catch (error) {
    console.error('[Sprint Join] Error:', error);
    return embeds.warn(message, 'Failed to join sprint. Please try again.');
  }
}

/**
 * Leave sprint command
 */
async function leaveSprint(client, message) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = await Sprint.findOne({
      guildId: message.guild.id,
      isActive: true
    });

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
        await sprint.save();

        // Update the sprint message
        try {
          const channel = await client.channels.fetch(sprint.channelId);
          const sprintMessage = await channel.messages.fetch(sprint.messageId);
          const updatedEmbed = createSprintEmbed(sprint.name, sprint.startTime, sprint.endTime, sprint.participants);
          await sprintMessage.edit({ embeds: [updatedEmbed] });
        } catch (err) {
          console.error('[Sprint Leave] Could not update message:', err);
        }

        // Edit confirmation with success
        const successEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(`${config.emojis.success} ${message.author}: You have left the reading sprint!`);

        await interaction.update({ embeds: [successEmbed], components: [] });
      }
    );

  } catch (error) {
    console.error('[Sprint Leave] Error:', error);
    return embeds.warn(message, 'Failed to leave sprint. Please try again.');
  }
}

/**
 * Update sprint progress command
 */
async function updateSprint(client, message, args) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = await Sprint.findOne({
      guildId: message.guild.id,
      isActive: true
    });

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    // Check if user is in sprint
    const participant = sprint.participants.find(p => p.userId === message.author.id);
    if (!participant) {
      return embeds.warn(message, 'You are not part of the current sprint!');
    }

    const currentTab = parseInt(args[0]);
    if (isNaN(currentTab) || currentTab < 0) {
      return embeds.warn(message, 'Usage: `,sprint update [page number]`\nExample: `,sprint update 45`');
    }

    const oldTab = participant.currentTab;
    participant.currentTab = currentTab;
    await sprint.save();

    // Update the sprint message
    try {
      const channel = await client.channels.fetch(sprint.channelId);
      const sprintMessage = await channel.messages.fetch(sprint.messageId);
      const updatedEmbed = createSprintEmbed(sprint.name, sprint.startTime, sprint.endTime, sprint.participants);
      await sprintMessage.edit({ embeds: [updatedEmbed] });
    } catch (err) {
      console.error('[Sprint Update] Could not update message:', err);
    }

    const progress = currentTab - participant.startTab;
    return embeds.success(message, `Progress updated! **${oldTab}** → **${currentTab}** (Total progress: **${progress}** tabs)`);

  } catch (error) {
    console.error('[Sprint Update] Error:', error);
    return embeds.warn(message, 'Failed to update progress. Please try again.');
  }
}

/**
 * Show sprint leaderboard
 */
async function showLeaderboard(client, message) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) {
      return embeds.warn(message, 'Database not ready. Please try again in a moment.');
    }

    const sprint = await Sprint.findOne({
      guildId: message.guild.id,
      isActive: true
    });

    if (!sprint) {
      return embeds.warn(message, 'There is no active **reading sprint** in this server!');
    }

    if (sprint.participants.length === 0) {
      return embeds.warn(message, 'No participants in the current sprint yet!');
    }

    // Calculate progress and sort
    const results = sprint.participants.map(p => {
      const participant = p.toObject ? p.toObject() : p;
      return {
        userId: participant.userId,
        username: participant.username,
        bookName: participant.bookName,
        startTab: participant.startTab,
        currentTab: participant.currentTab,
        progress: participant.currentTab - participant.startTab
      };
    }).sort((a, b) => b.progress - a.progress);

    // Find user's position
    const userPosition = results.findIndex(p => p.userId === message.author.id) + 1;

    let description = '';
    const top10 = results.slice(0, 10);

    top10.forEach((p, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`${String(index + 1).padStart(2, '0')}\``;
      description += `${medal} **${p.username}**: \`${p.progress}\` tabs - **${p.bookName}**\n`;
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
    console.error('[Sprint Leaderboard] Error:', error);
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
    console.error('[Sprint History] Error:', error);
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
    console.error('[Save Sprint History] Error:', error);
  }
}
