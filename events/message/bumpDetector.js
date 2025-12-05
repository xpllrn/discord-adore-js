const { getService } = require('@services');
const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
const logger = require('../../utils/logger');

// Disboard bot ID
const DISBOARD_BOT_ID = '302050872383242240';

// Default messages
const DEFAULT_THANKYOU_MESSAGE = `{container}$v{message: {user.mention}}$v{text: thank you for bumping **{guild.name}**:nextline: please bump again {bumpreminder.next_bump} }`;
const DEFAULT_REMINDER_MESSAGE = `{container}$v{message: {bumpreminder.last_user_bump}}$v{text: it's been **2 hours** since the last bump, could you /bump the server?}`;

// Store active reminder timeouts (guildId -> timeout)
const activeReminders = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Only check messages from Disboard bot
    if (message.author.id !== DISBOARD_BOT_ID) return;
    
    // Must be in a guild
    if (!message.guild) return;

    // Check if this is a successful bump message
    // Disboard sends an embed with "Bump done!" when successful
    if (!message.embeds || message.embeds.length === 0) return;
    
    const embed = message.embeds[0];
    
    // Check for successful bump - look for "Bump done!" in description
    const isSuccessfulBump = embed.description?.includes('Bump done!');
    
    if (!isSuccessfulBump) return;

    // Get who bumped from interaction metadata
    let bumperId = null;
    
    // Check interactionMetadata first (newer Discord.js)
    if (message.interactionMetadata?.user) {
      // interactionMetadata.user can be a string ID or user object
      bumperId = typeof message.interactionMetadata.user === 'string' 
        ? message.interactionMetadata.user 
        : message.interactionMetadata.user.id;
    }
    // Fallback to interaction object
    else if (message.interaction?.user) {
      bumperId = typeof message.interaction.user === 'string'
        ? message.interaction.user
        : message.interaction.user.id;
    }

    if (!bumperId) return;

    try {
      const guildService = getService('guild');
      const bumpReminder = await guildService.getBumpReminder(message.guild.id);

      // Check if bump reminder is enabled
      if (!bumpReminder.enabled) return;

      // Check if channel is configured
      if (!bumpReminder.channelId) return;

      const channel = message.guild.channels.cache.get(bumpReminder.channelId);
      if (!channel) return;

      // Get the user who bumped
      const bumper = await message.client.users.fetch(bumperId).catch(() => null);
      if (!bumper) return;

      // Calculate timestamps
      const now = Date.now();
      const nextBumpTime = now + (2 * 60 * 60 * 1000); // 2 hours from now
      const nextBumpTimestamp = Math.floor(nextBumpTime / 1000);

      // Update bump reminder data
      await guildService.updateBumpReminder(message.guild.id, {
        lastBumperId: bumperId,
        lastBumpTime: now
      });

      // Clear any existing reminder for this guild
      if (activeReminders.has(message.guild.id)) {
        clearTimeout(activeReminders.get(message.guild.id));
        activeReminders.delete(message.guild.id);
      }

      // Send thank you message
      const thankYouMessage = bumpReminder.thankYouMessage || DEFAULT_THANKYOU_MESSAGE;
      
      // Small delay to let Disboard's message settle
      setTimeout(() => {
        EmbedVariableProcessor.process(channel, thankYouMessage, {
          user: bumper,
          guild: message.guild,
          channel: channel,
          bumpreminder: {
            last_user_bump: `<@${bumperId}>`,
            next_bump: `<t:${nextBumpTimestamp}:R>`
          }
        });
      }, 1500);

      // Schedule reminder for 2 hours later
      const reminderTimeout = setTimeout(async () => {
        try {
          // Re-fetch bump reminder data to ensure it's still enabled
          const currentBumpReminder = await guildService.getBumpReminder(message.guild.id);
          
          if (!currentBumpReminder.enabled) {
            activeReminders.delete(message.guild.id);
            return;
          }

          const reminderChannel = message.guild.channels.cache.get(currentBumpReminder.channelId);
          if (!reminderChannel) {
            activeReminders.delete(message.guild.id);
            return;
          }

          // Send reminder message
          const reminderMsg = currentBumpReminder.reminderMessage || DEFAULT_REMINDER_MESSAGE;
          
          EmbedVariableProcessor.process(reminderChannel, reminderMsg, {
            user: { id: currentBumpReminder.lastBumperId, mention: `<@${currentBumpReminder.lastBumperId}>` },
            guild: message.guild,
            channel: reminderChannel,
            bumpreminder: {
              last_user_bump: `<@${currentBumpReminder.lastBumperId}>`,
              next_bump: `<t:${Math.floor(Date.now() / 1000)}:R>`
            }
          });

          activeReminders.delete(message.guild.id);
        } catch (error) {
          logger.console.error(`Error sending bump reminder for guild ${message.guild.id}:`, error);
          activeReminders.delete(message.guild.id);
        }
      }, 2 * 60 * 60 * 1000); // 2 hours

      // Store the timeout reference
      activeReminders.set(message.guild.id, reminderTimeout);

    } catch (error) {
      logger.console.error(`Error processing bump for guild ${message.guild?.id}:`, error);
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
