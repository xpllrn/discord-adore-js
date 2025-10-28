const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/setup');

// Get Sprint model from database
function getSprintModel() {
  const { getModels } = require('../database');
  const models = getModels();
  return models ? models.Sprint : null;
}

/**
 * Resume active sprints on bot startup
 */
async function resumeActiveSprints(client) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) {
      console.log('[Sprint Manager] Database not ready, skipping sprint resume');
      return;
    }

    const activeSprints = await Sprint.find({ isActive: true });
    console.log(`[Sprint Manager] Found ${activeSprints.length} active sprints to resume`);

    for (const sprint of activeSprints) {
      const now = Date.now();
      const endTime = sprint.endTime.getTime();

      // Check if sprint should have ended
      if (now >= endTime) {
        console.log(`[Sprint Manager] Auto-ending expired sprint ${sprint.messageId}`);
        await autoEndSprint(client, sprint.guildId, sprint.messageId);
        continue;
      }

      // Schedule remaining timers
      const timeUntilEnd = endTime - now;
      const thirtyMinutes = 30 * 60 * 1000;

      // Schedule reminder if not sent and within 30 minutes
      if (!sprint.reminderSent && timeUntilEnd <= thirtyMinutes) {
        console.log(`[Sprint Manager] Sending immediate reminder for sprint ${sprint.messageId}`);
        await sendSprintReminder(client, sprint.guildId, sprint.messageId);
      }

      // Schedule auto-end with better error handling
      if (timeUntilEnd > 0) {
        setTimeout(async () => {
          try {
            await autoEndSprint(client, sprint.guildId, sprint.messageId);
          } catch (error) {
            console.error('[Sprint Auto-End] Error:', error);
          }
        }, timeUntilEnd);
        console.log(`[Sprint Manager] Scheduled auto-end for sprint ${sprint.messageId} in ${Math.round(timeUntilEnd / 1000 / 60)} minutes`);
      }
    }
  } catch (error) {
    console.error('[Sprint Manager] Error resuming sprints:', error);
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
      console.error('[Sprint Auto-End] Could not update message:', err);
    }
  } catch (error) {
    console.error('[Sprint Auto-End] Error:', error);
  }
}

/**
 * Send reminder to sprint participants
 */
async function sendSprintReminder(client, guildId, messageId) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) return;

    const sprint = await Sprint.findOne({
      guildId,
      messageId,
      isActive: true,
      reminderSent: false
    });

    if (!sprint || sprint.participants.length === 0) return;

    // Mark reminder as sent
    sprint.reminderSent = true;
    await sprint.save();

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
    console.error('[Sprint Reminder] Error:', error);
  }
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
 * Save sprint results to user history
 */
async function saveSprintHistory(sprint) {
  try {
    const { getModels } = require('../database');
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

module.exports = {
  resumeActiveSprints,
  autoEndSprint,
  sendSprintReminder
};