const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createPagination } = require('../../core/buttons');
const { runHelpCommand } = require('../../utils/commandProcessor');
const config = require('../../config/setup');
const { findUser } = require('../../handlers/finder');

module.exports = {
  name: "blacklist",
  aliases: ['bl', 'globalban'],
  description: 'Universal blacklist system for users and servers',
  usage: `{guildprefix}blacklist users
{guildprefix}blacklist users {user.id} {reason}

{guildprefix}blacklist servers
{guildprefix}blacklist servers {server.id} {reason}`,
  permission: 'dev',
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'blacklist');
    }

    const subcommand = args[0].toLowerCase();

    if (subcommand === 'users' || subcommand === 'user') {
      if (args[1]) {

        await handleUserBlacklist(client, message, args);
      } else {

        await listBlacklistedUsers(client, message);
      }
    } else if (subcommand === 'servers' || subcommand === 'server') {
      if (args[1]) {

        await handleServerBlacklist(client, message, args);
      } else {

        await listBlacklistedServers(client, message);
      }
    } else {
      return runHelpCommand(message, 'blacklist');
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
    const systemCache = require('../../database/cache/models/system');

    const wasBlacklisted = await systemCache.getUserBlacklist(userId);
    const newBlacklistStatus = !wasBlacklisted;

    let success;
    if (newBlacklistStatus) {
      success = await systemCache.addUserBlacklist(userId, reason, message.author.id);
    } else {
      success = await systemCache.removeUserBlacklist(userId);
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
    const systemCache = require('../../database/cache/models/system');

    const wasBlacklisted = await systemCache.getServerBlacklist(serverId);
    const newBlacklistStatus = !wasBlacklisted;

    let success;
    if (newBlacklistStatus) {
      success = await systemCache.addServerBlacklist(serverId, reason, message.author.id);
    } else {
      success = await systemCache.removeServerBlacklist(serverId);
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
    const systemCache = require('../../database/cache/models/system');
    const blacklistedUsers = await systemCache.getAllBlacklistedUsers();

    if (blacklistedUsers.length === 0) {
      return embeds.info(message, 'No users are currently **blacklisted**.');
    }

    const userList = [];
    for (let i = 0; i < blacklistedUsers.length; i++) {
      const user = blacklistedUsers[i];
      try {
        const discordUser = await client.users.fetch(user.userId);
        userList.push(`\`${i + 1}\` **${discordUser.username}** (\`${user.userId}\`) - ${user.reason}`);
      } catch {
        userList.push(`\`${i + 1}\` **Blacklisted User** (\`${user.userId}\`) - ${user.reason}`);
      }
    }

    return createPaginatedList(message, userList, 'Blacklisted Users');

  } catch (error) {
    return embeds.deny(message, 'An error occurred while fetching **blacklisted users**.');
  }
}

async function listBlacklistedServers(client, message) {
  try {
    const systemCache = require('../../database/cache/models/system');
    const blacklistedServers = await systemCache.getAllBlacklistedServers();

    if (blacklistedServers.length === 0) {
      return embeds.info(message, 'No servers are currently **blacklisted**.');
    }

    const serverList = [];
    for (let i = 0; i < blacklistedServers.length; i++) {
      const server = blacklistedServers[i];
      try {
        const guild = client.guilds.cache.get(server.serverId);
        const serverName = guild ? guild.name : 'Unknown Server';
        serverList.push(`\`${i + 1}\` **${serverName}** (\`${server.serverId}\`) - ${server.reason}`);
      } catch {
        serverList.push(`\`${i + 1}\` **blacklisted srv** (\`${server.serverId}\`) - ${server.reason}`);
      }
    }

    return createPaginatedList(message, serverList, 'Blacklisted Servers');

  } catch (error) {
    return embeds.deny(message, 'An error occurred while fetching **blacklisted servers**.');
  }
}
