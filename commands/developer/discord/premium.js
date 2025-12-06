const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');
const { getService } = require('@services');

module.exports = {
  name: "premium",
  aliases: ['prem'],
  description: 'Manage premium users and servers',
  permission: 'developer',
  syntax: 'premium [subcommand] (parameters)',
  example: 'premium add 123456789',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add premium to a user or server',
      syntax: '{guildprefix}premium add [id]',
      parameters: ['id'],
      example: '{guildprefix}premium add 123456789012345678',

      handler: async (client, message, args) => {
        return handlePremiumToggle(client, message, args, 'add');
      }
    },

    remove: {
      name: 'remove',
      aliases: ['rm'],
      description: 'Remove premium from a user or server',
      syntax: '{guildprefix}premium remove [id]',
      parameters: ['id'],
      example: '{guildprefix}premium remove 123456789012345678',

      handler: async (client, message, args) => {
        return handlePremiumToggle(client, message, args, 'remove');
      }
    },

    list: {
      name: 'list',
      aliases: ['ls'],
      description: 'List all premium users and servers',
      syntax: '{guildprefix}premium list (users/servers)',
      parameters: ['type (optional)'],
      example: '{guildprefix}premium list',

      handler: async (client, message, args) => {
        const type = args[0]?.toLowerCase();
        
        if (type === 'users' || type === 'user') {
          return listPremiumUsers(client, message);
        } else if (type === 'servers' || type === 'server') {
          return listPremiumServers(client, message);
        } else {
          return listAllPremium(client, message);
        }
      }
    },

    check: {
      name: 'check',
      aliases: ['status'],
      description: 'Check if a user or server has premium',
      syntax: '{guildprefix}premium check [id]',
      parameters: ['id'],
      example: '{guildprefix}premium check 123456789012345678',

      handler: async (client, message, args) => {
        return checkPremiumStatus(client, message, args);
      }
    }
  },

  run: async (client, message, args) => {
    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'premium');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'premium');
  }
};


// Detect if ID is a user or server
async function detectIdType(client, id) {
  // Try to fetch as user first
  try {
    const user = await client.users.fetch(id).catch(() => null);
    if (user) {
      return { type: 'user', data: user };
    }
  } catch (error) {}

  // Try to find as server
  try {
    const guild = client.guilds.cache.get(id);
    if (guild) {
      return { type: 'server', data: guild };
    }
  } catch (error) {}

  // If not found in cache, check if it looks like a valid Discord ID
  if (/^\d{17,19}$/.test(id)) {
    // Could be either, but we'll default to checking system data
    const systemService = getService('system');
    
    // Check if it's already in premium as user or server
    const isPremUser = await systemService.isPremiumUser(id);
    if (isPremUser) {
      return { type: 'user', data: null, id };
    }
    
    const isPremServer = await systemService.isPremiumServer(id);
    if (isPremServer) {
      return { type: 'server', data: null, id };
    }
    
    // Default to unknown - let user specify
    return { type: 'unknown', data: null, id };
  }

  return { type: 'invalid', data: null };
}

async function handlePremiumToggle(client, message, args, action) {
  const input = args[0];
  
  if (!input) {
    return embeds.warn(message, `Please provide a **user or server ID**: \`,premium ${action} 123456789\``);
  }

  // Clean the input (remove mentions)
  const id = input.replace(/[<@!#>]/g, '');

  if (!/^\d{17,19}$/.test(id)) {
    return embeds.warn(message, 'Please provide a **valid Discord ID**!');
  }

  try {
    const systemService = getService('system');
    const detection = await detectIdType(client, id);

    // If type is unknown, try to determine based on context
    let targetType = detection.type;
    let targetData = detection.data;
    let displayName = '';

    if (targetType === 'user' && targetData) {
      displayName = `**${targetData.username}** (\`${targetData.id}\`)`;
    } else if (targetType === 'server' && targetData) {
      displayName = `**${targetData.name}** (\`${targetData.id}\`)`;
    } else if (targetType === 'unknown') {
      // For unknown IDs during add, we need to make a decision
      // Check if user wants to add as user or server by trying to fetch
      const userResult = await findUser(message.guild, id, client).catch(() => null);
      if (userResult?.found) {
        targetType = 'user';
        targetData = userResult.isGlobal ? userResult.user : userResult.user.user;
        displayName = `**${targetData.username}** (\`${targetData.id}\`)`;
      } else {
        // Assume it's a server ID
        targetType = 'server';
        displayName = `**Server** (\`${id}\`)`;
      }
    } else if (targetType === 'invalid') {
      return embeds.warn(message, 'Could not find a **user or server** with that ID!');
    } else {
      displayName = `**ID:** \`${id}\``;
    }

    let success;
    let actionText;

    if (action === 'add') {
      if (targetType === 'user') {
        success = await systemService.addPremiumUser(id, message.author.id);
        actionText = success ? `Added ${displayName} to **premium users**` : `${displayName} already has **premium**`;
      } else {
        success = await systemService.addPremiumServer(id, message.author.id);
        actionText = success ? `Added ${displayName} to **premium servers**` : `${displayName} already has **premium**`;
      }
    } else {
      if (targetType === 'user') {
        success = await systemService.removePremiumUser(id);
        actionText = success ? `Removed ${displayName} from **premium users**` : `${displayName} doesn't have **premium**`;
      } else {
        success = await systemService.removePremiumServer(id);
        actionText = success ? `Removed ${displayName} from **premium servers**` : `${displayName} doesn't have **premium**`;
      }
    }

    if (success) {
      return embeds.success(message, actionText);
    } else {
      return embeds.warn(message, actionText);
    }

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'An error occurred while updating **premium** status.');
  }
}

async function checkPremiumStatus(client, message, args) {
  const input = args[0];
  
  if (!input) {
    return embeds.warn(message, 'Please provide a **user or server ID**: `,premium check 123456789`');
  }

  const id = input.replace(/[<@!#>]/g, '');

  if (!/^\d{17,19}$/.test(id)) {
    return embeds.warn(message, 'Please provide a **valid Discord ID**!');
  }

  try {
    const systemService = getService('system');
    
    // Check database premium
    const isPremUserDb = await systemService.isPremiumUser(id);
    const isPremServer = await systemService.isPremiumServer(id);
    
    // Check role-based premium (for users)
    let hasRolePremium = false;
    if (config.permissions.premiumRoleId && config.bot.devServerId) {
      const devServer = client.guilds.cache.get(config.bot.devServerId);
      if (devServer) {
        const member = await devServer.members.fetch(id).catch(() => null);
        if (member && member.roles.cache.has(config.permissions.premiumRoleId)) {
          hasRolePremium = true;
        }
      }
    }

    // Try to get display info
    let userInfo = null;
    let serverInfo = null;

    try {
      const user = await client.users.fetch(id).catch(() => null);
      if (user) {
        userInfo = `**${user.username}** (\`${user.id}\`)`;
      }
    } catch (error) {}

    try {
      const guild = client.guilds.cache.get(id);
      if (guild) {
        serverInfo = `**${guild.name}** (\`${guild.id}\`)`;
      }
    } catch (error) {}

    const displayName = userInfo || serverInfo || `**ID:** \`${id}\``;
    const isPremUser = isPremUserDb || hasRolePremium;

    // Build detailed status
    const sources = [];
    if (hasRolePremium) sources.push('role');
    if (isPremUserDb) sources.push('database');

    if (isPremUser && isPremServer) {
      return embeds.success(message, `${displayName} has **premium** as both **user** (${sources.join(' + ')}) and **server**`);
    } else if (isPremUser) {
      return embeds.success(message, `${displayName} has **premium** as a **user** (${sources.join(' + ')})`);
    } else if (isPremServer) {
      return embeds.success(message, `${displayName} has **premium** as a **server**`);
    } else {
      return embeds.warn(message, `${displayName} does **not** have **premium**`);
    }

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'An error occurred while checking **premium** status.');
  }
}


async function listPremiumUsers(client, message) {
  try {
    const systemService = getService('system');
    const premiumInfo = await systemService.getPremiumInfo();
    const premiumUsers = premiumInfo.users || [];

    if (premiumUsers.length === 0) {
      return embeds.info(message, 'No users have **premium**.');
    }

    const userList = [];
    for (let i = 0; i < premiumUsers.length; i++) {
      const entry = premiumUsers[i];
      const userId = typeof entry === 'string' ? entry : entry.userId;
      const addedAt = entry.addedAt ? new Date(entry.addedAt).toLocaleDateString() : 'Unknown';
      
      try {
        const user = await client.users.fetch(userId);
        userList.push(`\`${String(i + 1).padStart(2, '0')}\` **${user.username}** (\`${userId}\`) - ${addedAt}`);
      } catch {
        userList.push(`\`${String(i + 1).padStart(2, '0')}\` **Unknown User** (\`${userId}\`) - ${addedAt}`);
      }
    }

    return createPaginatedList(message, userList, 'Premium Users');

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'An error occurred while fetching **premium users**.');
  }
}

async function listPremiumServers(client, message) {
  try {
    const systemService = getService('system');
    const premiumInfo = await systemService.getPremiumInfo();
    const premiumServers = premiumInfo.servers || [];

    if (premiumServers.length === 0) {
      return embeds.info(message, 'No servers have **premium**.');
    }

    const serverList = [];
    for (let i = 0; i < premiumServers.length; i++) {
      const entry = premiumServers[i];
      const serverId = typeof entry === 'string' ? entry : entry.serverId;
      const addedAt = entry.addedAt ? new Date(entry.addedAt).toLocaleDateString() : 'Unknown';
      
      try {
        const guild = client.guilds.cache.get(serverId);
        const serverName = guild ? guild.name : 'Unknown Server';
        serverList.push(`\`${String(i + 1).padStart(2, '0')}\` **${serverName}** (\`${serverId}\`) - ${addedAt}`);
      } catch {
        serverList.push(`\`${String(i + 1).padStart(2, '0')}\` **Unknown Server** (\`${serverId}\`) - ${addedAt}`);
      }
    }

    return createPaginatedList(message, serverList, 'Premium Servers');

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'An error occurred while fetching **premium servers**.');
  }
}

async function listAllPremium(client, message) {
  try {
    const systemService = getService('system');
    const premiumInfo = await systemService.getPremiumInfo();
    
    const premiumUsers = premiumInfo.users || [];
    const premiumServers = premiumInfo.servers || [];

    // Count role-based premium users from dev server
    let roleBasedCount = 0;
    if (config.permissions.premiumRoleId && config.bot.devServerId) {
      const devServer = client.guilds.cache.get(config.bot.devServerId);
      if (devServer) {
        const role = devServer.roles.cache.get(config.permissions.premiumRoleId);
        if (role) {
          roleBasedCount = role.members.size;
        }
      }
    }

    if (premiumUsers.length === 0 && premiumServers.length === 0 && roleBasedCount === 0) {
      return embeds.info(message, 'No users or servers have **premium**.');
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: 'Premium Overview',
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setDescription(
        `**Users (Database):** ${premiumUsers.length}\n` +
        `**Users (Role):** ${roleBasedCount}\n` +
        `**Servers:** ${premiumServers.length}`
      )
      .setFooter({ text: 'Use ,premium list users or ,premium list servers for details' });

    // Add first few database users
    if (premiumUsers.length > 0) {
      const userPreview = [];
      for (let i = 0; i < Math.min(5, premiumUsers.length); i++) {
        const entry = premiumUsers[i];
        const userId = typeof entry === 'string' ? entry : entry.userId;
        try {
          const user = await client.users.fetch(userId);
          userPreview.push(`${user.username}`);
        } catch {
          userPreview.push(`\`${userId}\``);
        }
      }
      const moreUsers = premiumUsers.length > 5 ? ` (+${premiumUsers.length - 5} more)` : '';
      embed.addFields({ name: 'Premium Users (Database)', value: userPreview.join(', ') + moreUsers, inline: false });
    }

    // Add first few servers
    if (premiumServers.length > 0) {
      const serverPreview = [];
      for (let i = 0; i < Math.min(5, premiumServers.length); i++) {
        const entry = premiumServers[i];
        const serverId = typeof entry === 'string' ? entry : entry.serverId;
        const guild = client.guilds.cache.get(serverId);
        serverPreview.push(guild ? guild.name : `\`${serverId}\``);
      }
      const moreServers = premiumServers.length > 5 ? ` (+${premiumServers.length - 5} more)` : '';
      embed.addFields({ name: 'Premium Servers', value: serverPreview.join(', ') + moreServers, inline: false });
    }

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'An error occurred while fetching **premium** info.');
  }
}

function createPaginatedList(message, items, title, itemsPerPage = 6) {
  if (items.length > itemsPerPage) {
    const formatPage = (pageItems, currentPage, totalPages) => {
      return new EmbedBuilder()
        .setTitle(`**${title}**`)
        .setDescription(pageItems.join('\n'))
        .setColor(config.colors.info)
        .setFooter({ text: `Page ${currentPage}/${totalPages} • Total: ${items.length}` });
    };
    return createPagination(message, items, formatPage, itemsPerPage, title);
  } else {
    const embed = new EmbedBuilder()
      .setTitle(`**${title}**`)
      .setDescription(items.join('\n'))
      .setColor(config.colors.info)
      .setFooter({ text: `Total: ${items.length}` });
    return message.channel.send({ embeds: [embed] });
  }
}
