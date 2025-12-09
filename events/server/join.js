const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
const { getService } = require('@services');
const webhookLogger = require('../../utils/webhookLogger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      // CRITICAL: Skip all member processing until cache is ready
      if (!client.cacheReady) {
        return; // Don't process any member events during startup
      }

      // Check for hardban FIRST - before any other processing
      const isHardbanned = await checkHardban(member);
      if (isHardbanned) {
        return; // User was hardbanned and kicked, stop processing
      }

      // Log member join (always log, including bots)
      await logMemberJoin(member);

      // Antinuke check for bot additions
      if (member.user.bot) {
        await checkBotAddition(member);
        return; // Skip bots - they don't get welcome messages or autoroles
      }

      // Process autoroles first
      await processAutoroles(member);

      // Process welcome messages for all configured channels
      await processWelcomeMessages(member);

      // Process ping on join for all configured channels
      await processPingOnJoin(member);

    } catch (error) {
      // Silent fail for join event
    }
  },
};

async function checkHardban(member) {
  try {
    const guildService = getService('guild');
    
    // Check if user is hardbanned
    const isHardbanned = await guildService.isHardbanned(member.guild.id, member.user.id);

    if (isHardbanned) {
      // Get hardban details
      const hardbanInfo = await guildService.getHardban(member.guild.id, member.user.id);
      
      // Ban the user immediately
      try {
        await member.ban({ 
          reason: `[HARDBAN ENFORCEMENT] ${hardbanInfo?.reason || 'User is hardbanned'} | Original ban by: ${hardbanInfo?.bannedBy || 'Unknown'}` 
        });

        // Log the enforcement
        const webhookLogger = require('../../utils/webhookLogger');
        const embed = webhookLogger.createModeratorLog({
          action: 'hardban_enforced',
          executor: member.client.user,
          target: member.user,
          reason: `Hardban enforcement - ${hardbanInfo?.reason || 'User is hardbanned'}`,
          guild: member.guild
        });

        await webhookLogger.sendLog(member.guild.id, 'moderator', embed);
      } catch (banError) {
        // Silent fail if ban fails
      }

      return true; // User was hardbanned
    }

    return false; // User is not hardbanned
  } catch (error) {
    // Silent fail for hardban check
    return false;
  }
}

async function processWelcomeMessages(member) {
  try {
    const guildService = getService('guild');
    
    // Get welcome messages from multi-channel system
    const welcomeMessages = await guildService.getWelcomeMessages(member.guild.id) || [];

    if (welcomeMessages.length === 0) {
      return; // No welcome messages configured
    }

    // Process each welcome message
    for (const welcomeConfig of welcomeMessages) {
      try {
        // Get the welcome channel
        const welcomeChannel = member.guild.channels.cache.get(welcomeConfig.channelId);
        if (!welcomeChannel) {
          // Channel no longer exists, remove from config
          await guildService.removeWelcomeMessage(member.guild.id, welcomeConfig.channelId);
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
            channel: welcomeChannel,
            pingEnabled: welcomeConfig.pingEnabled || false,
            selfDestruct: welcomeConfig.selfDestruct || 0
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

async function processPingOnJoin(member) {
  try {
    const guildService = getService('guild');
    
    // Get ping on join channels
    const pojChannels = await guildService.getPingOnJoinChannels(member.guild.id) || [];

    if (pojChannels.length === 0) {
      return; // No ping on join configured
    }

    // Process each ping on join channel
    for (const pojConfig of pojChannels) {
      try {
        const pojChannel = member.guild.channels.cache.get(pojConfig.channelId);
        if (!pojChannel) {
          // Channel no longer exists, remove from config
          await guildService.removePingOnJoin(member.guild.id, pojConfig.channelId);
          continue;
        }

        // Check if bot has permission to send and delete messages
        if (!pojChannel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'ManageMessages'])) {
          continue;
        }

        // Send ping message and delete immediately
        const sentMessage = await pojChannel.send(`${member}`);
        await sentMessage.delete().catch(() => {});
      } catch (error) {
        // Silent fail for individual ping on join
      }
    }
  } catch (error) {
    // Silent fail for ping on join system
  }
}

async function processAutoroles(member) {
  try {
    const guildService = getService('guild');
    
    // Get autorole data for this guild using service layer
    const autoRoleIds = await guildService.getAutoRoles(member.guild.id);

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

    // Clean up invalid roles using service layer
    if (invalidRoles.length > 0) {
      for (const invalidRoleId of invalidRoles) {
        await guildService.removeAutoRole(member.guild.id, invalidRoleId);
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

async function checkBotAddition(member) {
  try {
    const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
    const antinukeService = getService('antinuke');
    
    const settings = await antinukeService.getSettings(member.guild.id);
    
    // Check if botadd protection is enabled
    if (!settings.enabled || !settings.modules.botadd.enabled) {
      return;
    }

    // Get audit log to find who added the bot
    let executor = null;
    try {
      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.BotAdd,
        limit: 1
      });

      const auditEntry = auditLogs.entries.first();
      if (auditEntry && 
          auditEntry.target?.id === member.id &&
          Date.now() - auditEntry.createdTimestamp < 5000) {
        executor = auditEntry.executor;
      }
    } catch (auditError) {
      // Silent fail if can't access audit logs
      return;
    }

    if (!executor || executor.bot) {
      return;
    }

    // Check if executor is whitelisted
    if (await antinukeService.isWhitelisted(member.guild.id, executor.id)) {
      return;
    }

    const punishment = settings.modules.botadd.punishment || 'kick';

    // Kick the bot first
    await member.kick('Antinuke: Unauthorized bot addition').catch(() => {});

    // Apply punishment to executor
    await antinukeService.applyPunishment(
      member.guild,
      executor.id,
      punishment,
      'Antinuke: Unauthorized bot addition',
      [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild]
    );

    await antinukeService.logAction(
      member.guild.id,
      'bot_add_blocked',
      executor.id,
      `Blocked unauthorized bot addition: ${member.user.tag} - Punishment: ${punishment}`
    );
  } catch (error) {
    // Silent fail for antinuke
  }
}
