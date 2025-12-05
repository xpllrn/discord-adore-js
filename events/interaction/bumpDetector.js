const { getService } = require('@services');
const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
const logger = require('../../utils/logger');

// Disboard bump command ID
const DISBOARD_BUMP_COMMAND_ID = '947088344167366698';

// Default messages
const DEFAULT_THANKYOU_MESSAGE = `{container}$v{message: {user.mention}}$v{text: thank you for bumping **{guild.name}**:nextline: please bump again {bumpreminder.next_bump} }`;
const DEFAULT_REMINDER_MESSAGE = `{container}$v{message: {bumpreminder.last_user_bump}}$v{text: it's been **2 hours** since the last bump, could you /bump the server?}`;

// Store active reminder timeouts (guildId -> timeout)
const activeReminders = new Map();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Only handle application commands (slash commands)
    if (!interaction.isCommand()) return;
    
    // Check if this is the Disboard bump command
    if (interaction.commandId !== DISBOARD_BUMP_COMMAND_ID) return;
    
    // Must be in a guild
    if (!interaction.guild) return;

    try {
      const guildService = getService('guild');
      const bumpReminder = await guildService.getBumpReminder(interaction.guild.id);

      // Check if bump reminder is enabled
      if (!bumpReminder.enabled) return;

      // Check if channel is configured
      if (!bumpReminder.channelId) return;

      const channel = interaction.guild.channels.cache.get(bumpReminder.channelId);
      if (!channel) return;

      // Calculate timestamps
      const now = Date.now();
      const nextBumpTime = now + (2 * 60 * 60 * 1000); // 2 hours from now
      const nextBumpTimestamp = Math.floor(nextBumpTime / 1000);

      // Update bump reminder data
      await guildService.updateBumpReminder(interaction.guild.id, {
        lastBumperId: interaction.user.id,
        lastBumpTime: now
      });

      // Clear any existing reminder for this guild
      if (activeReminders.has(interaction.guild.id)) {
        clearTimeout(activeReminders.get(interaction.guild.id));
        activeReminders.delete(interaction.guild.id);
      }

      // Send thank you message
      const thankYouMessage = bumpReminder.thankYouMessage || DEFAULT_THANKYOU_MESSAGE;
      
      // Small delay to let Disboard respond first
      setTimeout(() => {
        EmbedVariableProcessor.process(channel, thankYouMessage, {
          user: interaction.user,
          guild: interaction.guild,
          channel: channel,
          bumpreminder: {
            last_user_bump: `<@${interaction.user.id}>`,
            next_bump: `<t:${nextBumpTimestamp}:R>`
          }
        });
      }, 2000);

      // Schedule reminder for 2 hours later
      const reminderTimeout = setTimeout(async () => {
        try {
          // Re-fetch bump reminder data to ensure it's still enabled
          const currentBumpReminder = await guildService.getBumpReminder(interaction.guild.id);
          
          if (!currentBumpReminder.enabled) {
            activeReminders.delete(interaction.guild.id);
            return;
          }

          const reminderChannel = interaction.guild.channels.cache.get(currentBumpReminder.channelId);
          if (!reminderChannel) {
            activeReminders.delete(interaction.guild.id);
            return;
          }

          // Send reminder message
          const reminderMessage = currentBumpReminder.reminderMessage || DEFAULT_REMINDER_MESSAGE;
          
          EmbedVariableProcessor.process(reminderChannel, reminderMessage, {
            user: { id: currentBumpReminder.lastBumperId, mention: `<@${currentBumpReminder.lastBumperId}>` },
            guild: interaction.guild,
            channel: reminderChannel,
            bumpreminder: {
              last_user_bump: `<@${currentBumpReminder.lastBumperId}>`,
              next_bump: `<t:${Math.floor(Date.now() / 1000)}:R>`
            }
          });

          activeReminders.delete(interaction.guild.id);
        } catch (error) {
          logger.console.error(`Error sending bump reminder for guild ${interaction.guild.id}:`, error);
          activeReminders.delete(interaction.guild.id);
        }
      }, 2 * 60 * 60 * 1000); // 2 hours

      // Store the timeout reference
      activeReminders.set(interaction.guild.id, reminderTimeout);

    } catch (error) {
      logger.console.error(`Error processing bump for guild ${interaction.guild?.id}:`, error);
    }
  }
};

// Export for cleanup on shutdown
module.exports.clearAllReminders = () => {
  for (const timeout of activeReminders.values()) {
    clearTimeout(timeout);
  }
  activeReminders.clear();
};

// Export active reminders map for potential status checks
module.exports.activeReminders = activeReminders;
