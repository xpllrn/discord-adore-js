const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
const webhookLogger = require('../../utils/webhookLogger');
const { getService } = require('@services');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    try {
      // Log member leave (always log, regardless of leave message configuration)
      await logMemberLeave(member);

      // Process leave messages for all configured channels
      await processLeaveMessages(member);

    } catch (error) {
      // Silent fail for leave event
    }
  },
};

async function processLeaveMessages(member) {
  try {
    const guildService = getService('guild');
    
    // Get leave messages from new multi-channel system
    const leaveMessages = await guildService.getLeaveMessages(member.guild.id) || [];

    if (leaveMessages.length === 0) {
      // Check for legacy leave message system
      await processLegacyLeave(member);
      return;
    }

    // Process each leave message
    for (const leaveConfig of leaveMessages) {
      try {
        // Get the leave channel
        const leaveChannel = member.guild.channels.cache.get(leaveConfig.channelId);
        if (!leaveChannel) {
          // Channel no longer exists, remove from config
          await guildService.removeLeaveMessage(member.guild.id, leaveConfig.channelId);
          continue;
        }

        // Check if bot has permission to send messages
        if (!leaveChannel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
          continue;
        }

        // Process and send the leave message with variables
        try {
          EmbedVariableProcessor.process(leaveChannel, leaveConfig.message, {
            user: member.user,
            guild: member.guild,
            channel: leaveChannel
          });
        } catch (error) {
          // Fallback to simple text message
          leaveChannel.send(`Goodbye ${member.user.username}!`);
        }
      } catch (error) {
        // Silent fail for individual leave message
      }
    }
  } catch (error) {
    // Silent fail for leave system
  }
}

async function processLegacyLeave(member) {
  try {
    const guildService = getService('guild');
    
    // Check for old single-channel leave system
    const leaveChannel = await guildService.getLeaveChannel(member.guild.id);
    const leaveMessage = await guildService.getLeaveMessage(member.guild.id);

    if (!leaveChannel || !leaveMessage) {
      return; // No legacy leave configured
    }

    // Get the leave channel
    const channel = member.guild.channels.cache.get(leaveChannel);
    if (!channel) {
      // Channel no longer exists, clean up legacy data
      await guildService.removeLeave(member.guild.id);
      return;
    }

    // Check if bot has permission to send messages
    if (!channel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
      return;
    }

    // Migrate to new system
    await guildService.addLeaveMessage(member.guild.id, leaveChannel, leaveMessage);

    // Clean up legacy data
    await guildService.removeLeave(member.guild.id);

    // Process and send the leave message with variables
    try {
      EmbedVariableProcessor.process(channel, leaveMessage, {
        user: member.user,
        guild: member.guild,
        channel: channel
      });
    } catch (error) {
      // Fallback to simple text message
      channel.send(`Goodbye ${member.user.username}!`);
    }
  } catch (error) {
    // Silent fail for legacy leave system
  }
}

async function logMemberLeave(member) {
  try {
    const embed = webhookLogger.createMemberLog({
      action: 'memberLeave',
      member: member,
      guild: member.guild
    });

    await webhookLogger.sendLog(member.guild.id, 'members', embed);
  } catch (error) {
    // Send error to webhook instead of console
    if (member.client?.errorLogger) {
      member.client.errorLogger.log(error, 'Member Leave Logging', {
        command: 'Member Leave Event',
        args: `User: ${member.user?.tag || 'Unknown'}`,
        user: member.user,
        guild: member.guild
      });
    }
  }
}
