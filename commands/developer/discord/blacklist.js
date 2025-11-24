const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "blacklist",
  aliases: ['bl', 'globalban'],
  description: 'Universal blacklist system for users and servers',
  permission: 'developer',
  syntax: 'blacklist [subcommand] (parameters)',
  example: 'blacklist users @user spam',
  isGroupCommand: true,
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'blacklist');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'users':
      case 'user': {
        const subcommandInfo = {
          description: 'Manage user blacklist - add/remove users or list all blacklisted users',
          usage: '{guildprefix}blacklist users [user.id] [reason]',
          aliases: ['user'],
          parameters: ['user.id', 'reason'],
          example: '{guildprefix}blacklist users @jonathan jon pork'
        };

        if (args[1]) {
          await handleUserBlacklist(client, message, args);
        } else {
          await listBlacklistedUsers(client, message);
        }
        break;
      }

      case 'servers':
      case 'server': {
        const subcommandInfo = {
          description: 'Manage server blacklist - add/remove servers or list all blacklisted servers',
          usage: '{guildprefix}blacklist servers [server.id] [reason]',
          aliases: ['server'],
          parameters: ['server.id', 'reason'],
          example: '{guildprefix}blacklist servers 987654321 abuse'
        };

        if (args[1]) {
          await handleServerBlacklist(client, message, args);
        } else {
          await listBlacklistedServers(client, message);
        }
        break;
      }

      default: {
        return runHelpCommand(message, 'blacklist');
      }
    }
  }
};

async function handleUserBlacklist(client, message, args) {
  const userInput = args[1];
  const reason = args.slice(2).join(' ') || 'reasons';

  let targetUser = null;
  let userId = null;

  const userResult = await findUser(message.guild, userInput, client);

  if (!userResult.found) {
    return embeds.warn(message, `Could not find user: **${userInput}**`);
  }

  if (userResult.isGlobal) {
    targetUser = userResult.user;
    userId = targetUser.id;
  } else {
    targetUser = userResult.user.user;
    userId = targetUser.id;
  }

  if (!client.permissions.checkSelfAction(message, targetUser, 'blacklist')) return;
  if (!client.permissions.checkBotAction(message, targetUser)) return;

  try {
    const { getService } = require('@services'); const systemService = getService('system');

    const wasBlacklisted = await systemService.getUserBlacklist(userId);
    const newBlacklistStatus = !wasBlacklisted;

    let success;
    if (newBlacklistStatus) {
      success = await systemService.addUserToBlacklist(userId, reason, message.author.id);
    } else {
      success = await systemService.removeUserFromBlacklist(userId);
    }

    if (!success) {
      return embeds.deny(message, 'An error occurred while updating the **blacklist**.');
    }

    const userInfo = `**${targetUser.username}** (\`${targetUser.id}\`)`;

    if (newBlacklistStatus) {
      return embeds.success(message, `${userInfo} has been **blacklisted** for ${reason}`);
    } else {
      return embeds.success(message, `${userInfo} has been **removed** from **blacklist**`);
    }

  } catch (error) {
    logger.webhook.error(error, 'User Blacklist Command', {
      user: message.author,
      guild: message.guild,
      channel: message.channel,
      command: 'blacklist users',
      args: `${targetUser?.username || userInput} - ${reason}`
    });
    return embeds.deny(message, 'An error occurred while updating the **blacklist**.');
  }
}

async function handleServerBlacklist(client, message, args) {
  const serverId = args[1];
  const reason = args.slice(2).join(' ') || 'reasons';

  if (!/^\d{17,19}$/.test(serverId)) {
    return embeds.warn(message, 'Please provide a **valid server ID**!');
  }

  try {
    const { getService } = require('@services'); const systemService = getService('system');

    const wasBlacklisted = await systemService.getServerBlacklist(serverId);
    const newBlacklistStatus = !wasBlacklisted;

    let success;
    if (newBlacklistStatus) {
      success = await systemService.addServerToBlacklist(serverId, reason, message.author.id);
    } else {
      success = await systemService.removeServerFromBlacklist(serverId);
    }

    if (!success) {
      return embeds.deny(message, 'An error occurred while updating the **blacklist**.');
    }

    const serverInfo = getServerInfo(client, serverId);

    if (newBlacklistStatus) {
      const guild = client.guilds.cache.get(serverId);

      if (guild) {
        try {
          await guild.leave();
          embeds.info(message, `Left the **blacklisted** server: **${guild.name}**`);
        } catch (error) {

        }
      }

      return embeds.success(message, `${serverInfo} has been **blacklisted** for ${reason}`);
    } else {
      return embeds.success(message, `${serverInfo} has been **removed** from **blacklist**`);
    }

  } catch (error) {
    logger.webhook.error(error, 'Server Blacklist Command', {
      user: message.author,
      guild: message.guild,
      channel: message.channel,
      command: 'blacklist servers',
      args: `${serverId} - ${reason}`
    });
    return embeds.deny(message, 'An error occurred while updating the **blacklist**.');
  }
}

function getServerInfo(client, serverId) {
  try {
    const guild = client.guilds.cache.get(serverId);
    return guild ? `**${guild.name}** (\`${guild.id}\`)` : `**Server ID:** \`${serverId}\``;
  } catch {
    return `**Server ID:** \`${serverId}\``;
  }
}

function createPaginatedList(message, items, title, itemsPerPage = 6) {
  if (items.length > itemsPerPage) {
    const formatPage = (pageItems, currentPage, totalPages) => {
      return new EmbedBuilder()
        .setTitle(`**${title}**`)
        .setDescription(pageItems.join('\n'))
        .setColor(config.colors.error)
        .setFooter({ text: `Page ${currentPage}/${totalPages} • Total: ${items.length} ${title.toLowerCase()}` });
    };
    return createPagination(message, items, formatPage, itemsPerPage, title);
  } else {
    const embed = new EmbedBuilder()
      .setTitle(`**${title}**`)
      .setDescription(items.join('\n'))
      .setColor(config.colors.error)
      .setFooter({ text: `Total: ${items.length} ${title.toLowerCase()}` });
    return message.channel.send({ embeds: [embed] });
  }
}

async function listBlacklistedUsers(client, message) {
  try {
    const { getService } = require('@services'); const systemService = getService('system');
    const blacklistInfo = await systemService.getBlacklistInfo();
    const blacklistedUsers = blacklistInfo.users || [];

    if (blacklistedUsers.length === 0) {
      return embeds.info(message, 'No users are currently **blacklisted**.');
    }

    const userList = [];
    for (let i = 0; i < blacklistedUsers.length; i++) {
      const user = blacklistedUsers[i];
      const userId = typeof user === 'string' ? user : user.userId;
      const reason = typeof user === 'string' ? 'No reason provided' : (user.reason || 'No reason provided');
      
      try {
        const discordUser = await client.users.fetch(userId);
        userList.push(`\`${i + 1}\` **${discordUser.username}** (\`${userId}\`) - ${reason}`);
      } catch {
        userList.push(`\`${i + 1}\` **Blacklisted User** (\`${userId}\`) - ${reason}`);
      }
    }

    return createPaginatedList(message, userList, 'Blacklisted Users');

  } catch (error) {
    logger.webhook.error(error, 'List Blacklisted Users', {
      user: message.author,
      guild: message.guild,
      channel: message.channel,
      command: 'blacklist users'
    });
    return embeds.deny(message, 'An error occurred while fetching **blacklisted users**.');
  }
}

async function listBlacklistedServers(client, message) {
  try {
    const { getService } = require('@services'); const systemService = getService('system');
    const blacklistInfo = await systemService.getBlacklistInfo();
    const blacklistedServers = blacklistInfo.servers || [];

    if (blacklistedServers.length === 0) {
      return embeds.info(message, 'No servers are currently **blacklisted**.');
    }

    const serverList = [];
    for (let i = 0; i < blacklistedServers.length; i++) {
      const server = blacklistedServers[i];
      const serverId = typeof server === 'string' ? server : server.serverId;
      const reason = typeof server === 'string' ? 'No reason provided' : (server.reason || 'No reason provided');
      
      try {
        const guild = client.guilds.cache.get(serverId);
        const serverName = guild ? guild.name : 'Unknown Server';
        serverList.push(`\`${i + 1}\` **${serverName}** (\`${serverId}\`) - ${reason}`);
      } catch {
        serverList.push(`\`${i + 1}\` **blacklisted srv** (\`${serverId}\`) - ${reason}`);
      }
    }

    return createPaginatedList(message, serverList, 'Blacklisted Servers');

  } catch (error) {
    logger.webhook.error(error, 'List Blacklisted Servers', {
      user: message.author,
      guild: message.guild,
      channel: message.channel,
      command: 'blacklist servers'
    });
    return embeds.deny(message, 'An error occurred while fetching **blacklisted servers**.');
  }
}
