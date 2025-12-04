const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../../utils/permissions');
const { findUser } = require('../../../handlers/finder');
const { ensureUserData, ensureGuildData } = require('../../../database');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "clear",
  aliases: [],
  description: 'Clear name history for users or servers',
  permission: 'developer',
  syntax: 'clear [subcommand] (parameters)',
  example: 'clear names @user',
  isGroupCommand: true,

  subcommands: {
    names: {
      name: 'names',
      aliases: ['usernames'],
      description: 'Clear a user\'s name change history',
      syntax: '{guildprefix}clear names [@user]',
      parameters: ['user'],
      example: '{guildprefix}clear names @user',

      handler: async (client, message, args) => {
        const userService = getService('user');

        if (!args[0]) {
          return runHelpCommand(message, 'clear');
        }

        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        let targetUser, targetMember;
        if (userResult.isGlobal) {
          targetUser = userResult.user;
          targetMember = null;
        } else {
          targetUser = userResult.user.user || userResult.user;
          targetMember = userResult.user;
        }

        await ensureUserData(targetUser.id);

        try {
          const nameHistory = await userService.getNameHistory(targetUser.id);

          if (nameHistory.length === 0) {
            const username = targetMember ? targetMember.displayName : targetUser.username;
            return embeds.warn(message, `**${username}** has no name history to clear`);
          }

          const username = targetMember ? targetMember.displayName : targetUser.username;

          await createConfirmation(
            message,
            `Are you sure you want to **clear** all name history for **${username}**?`,
            async (interaction) => {
              await userService.clearAllNameHistory(targetUser.id);
              const successEmbed = embeds.createSuccess(message, `**Cleared** all name history for **${username}**`);
              await interaction.editReply({ embeds: [successEmbed], components: [] });
            }
          );
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to clear name history');
        }
      }
    },

    servernames: {
      name: 'servernames',
      aliases: ['guildnames'],
      description: 'Clear the server\'s name change history',
      syntax: '{guildprefix}clear servernames [server id]',
      parameters: ['server id'],
      example: '{guildprefix}clear servernames 1234567890123456789',

      handler: async (client, message, args) => {
        const guildService = getService('guild');

        let targetGuildId = message.guild.id;
        let targetGuildName = message.guild.name;

        if (args[0]) {
          targetGuildId = args[0];
          
          try {
            const fetchedGuild = client.guilds.cache.get(targetGuildId);
            if (fetchedGuild) {
              targetGuildName = fetchedGuild.name;
            } else {
              targetGuildName = `Server ${targetGuildId}`;
            }
          } catch (error) {
            targetGuildName = `Server ${targetGuildId}`;
          }
        }

        await ensureGuildData(targetGuildId);

        try {
          const nameHistory = await guildService.getGuildNameHistory(targetGuildId);

          if (nameHistory.length === 0) {
            return embeds.warn(message, 'No guild name history to clear');
          }

          await createConfirmation(
            message,
            `Are you sure you want to **clear** all guild name history for **${targetGuildName}**?`,
            async (interaction) => {
              await guildService.clearAllGuildNameHistory(targetGuildId);
              const successEmbed = embeds.createSuccess(message, `**Cleared** all guild name history for **${targetGuildName}**`);
              await interaction.editReply({ embeds: [successEmbed], components: [] });
            }
          );
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to clear guild name history');
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasPermissionLevel(message, 'dev')) return;

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'clear');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'clear');
  }
};
