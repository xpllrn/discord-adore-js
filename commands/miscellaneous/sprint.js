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
  usage: '{guildprefix}sprint start [duration] [name]\n{guildprefix}sprint end',
  run: async(client, message, args) => {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['start', 'end'].includes(subcommand)) {
      return runHelpCommand(message, 'sprint');
    }

    switch (subcommand) {
      case 'start':
        return await startSprint(client, message, args.slice(1));
      case 'end':
        return await endSprint(client, message);
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
          .setStyle(ButtonStyle.Success)
          .setEmoji('📚'),
        new ButtonBuilder()
          .setCustomId('sprint_update')
          .setLabel('Update')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
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
    const results = sprint.participants.map(p => ({
      ...p,
      progress: p.currentTab - p.startTab
    })).sort((a, b) => b.progress - a.progress);

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
