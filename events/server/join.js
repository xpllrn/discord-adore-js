const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embedbuilder');
const guildCache = require('../../database/cache/models/guild');
const webhookLogger = require('../../utils/webhookLogger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      // Log member join (always log, including bots)
      await logMemberJoin(member);

      // Skip bots - they don't get welcome messages or autoroles
      if (member.user.bot) {
        return;
      }

      // Process autoroles first
      await processAutoroles(member);

      // Process welcome messages for all configured channels
      await processWelcomeMessages(member);

    } catch (error) {
      // Silent fail for join event
    }
  },
};

async function processWelcomeMessages(member) {
  try {
    // Get welcome messages from new multi-channel system
    const welcomeMessages = await guildCache.getWelcomeMessages(member.guild.id) || [];

    if (welcomeMessages.length === 0) {
      // Check for legacy welcome message system
      await processLegacyWelcome(member);
      return;
    }

    // Process each welcome message
    for (const welcomeConfig of welcomeMessages) {
      try {
        // Get the welcome channel
        const welcomeChannel = member.guild.channels.cache.get(welcomeConfig.channelId);
        if (!welcomeChannel) {
          // Channel no longer exists, remove from config
          await guildCache.removeWelcomeMessage(member.guild.id, welcomeConfig.channelId);
          continue;
        }

        // Check if bot has permission to send messages
        if (!welcomeChannel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
          continue;
        }

        // Process and send the welcome message with variables
        try {
          EmbedVariableProcessor.process(welcomeChannel, welcomeConfig.message, {
            user: member.user,
            guild: member.guild,
            channel: welcomeChannel
          });
        } catch (error) {
          // Fallback to simple text message
          welcomeChannel.send(`Welcome ${member}!`);
        }
      } catch (error) {
        // Silent fail for individual welcome message
      }
    }
  } catch (error) {
    // Silent fail for welcome system
  }
}

async function processLegacyWelcome(member) {
  try {
    // Check for old single-channel welcome system
    const welcomeChannel = await guildCache.getWelcomeChannel(member.guild.id);
    const welcomeMessage = await guildCache.getWelcomeMessage(member.guild.id);

    if (!welcomeChannel || !welcomeMessage) {
      return; // No legacy welcome configured
    }

    // Get the welcome channel
    const channel = member.guild.channels.cache.get(welcomeChannel);
    if (!channel) {
      // Channel no longer exists, clean up legacy data
      await guildCache.removeWelcome(member.guild.id);
      return;
    }

    // Check if bot has permission to send messages
    if (!channel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
      return;
    }

    // Migrate to new system
    await guildCache.addWelcomeMessage(member.guild.id, welcomeChannel, welcomeMessage);

    // Clean up legacy data
    await guildCache.removeWelcome(member.guild.id);

    // Process and send the welcome message with variables
    try {
      EmbedVariableProcessor.process(channel, welcomeMessage, {
        user: member.user,
        guild: member.guild,
        channel: channel
      });
    } catch (error) {
      // Fallback to simple text message
      channel.send(`Welcome ${member}!`);
    }
  } catch (error) {
    // Silent fail for legacy welcome system
  }
}

async function processAutoroles(member) {
  try {
    // Get autorole data for this guild using cache system
    const autoRoleIds = await guildCache.getAutoRoles(member.guild.id);

    if (!autoRoleIds || autoRoleIds.length === 0) {
      return; // No autoroles configured
    }

    // Get valid roles that still exist in the guild
    const validRoles = [];
    const invalidRoles = [];

    for (const roleId of autoRoleIds) {
      const role = member.guild.roles.cache.get(roleId);
      if (role) {
        // Check if bot can assign this role (hierarchy check)
        if (member.guild.members.me.roles.highest.position > role.position) {
          validRoles.push(role);
        }
      } else {
        invalidRoles.push(roleId);
      }
    }

    // Clean up invalid roles using cache system
    if (invalidRoles.length > 0) {
      for (const invalidRoleId of invalidRoles) {
        await guildCache.removeAutoRole(member.guild.id, invalidRoleId);
      }
    }

    // Assign valid roles to the member
    if (validRoles.length > 0) {
      try {
        await member.roles.add(validRoles, 'Autorole assignment');
      } catch (error) {
        // Silent fail for role assignment - could be due to permissions, role hierarchy, etc.
      }
    }

  } catch (error) {
    // Silent fail for autorole system
  }
}

async function logMemberJoin(member) {
  try {
    const embed = webhookLogger.createMemberLog({
      action: 'memberJoin',
      member: member,
      guild: member.guild
    });

    await webhookLogger.sendLog(member.guild.id, 'members', embed);
  } catch (error) {
    // Send error to webhook instead of console
    if (member.client?.errorLogger) {
      member.client.errorLogger.log(error, 'Member Join Logging', {
        command: 'Member Join Event',
        args: `User: ${member.user?.tag || 'Unknown'}`,
        user: member.user,
        guild: member.guild
      });
    }
  }
}
