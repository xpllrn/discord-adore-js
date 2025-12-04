const { PermissionFlagsBits, EmbedBuilder, AutoModerationRuleTriggerType, AutoModerationActionType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findRole, findUser } = require('../../../handlers/finder');
const { colors, emojis } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "filter",
  aliases: ['automod'],
  description: "Manage Discord's built-in AutoMod filtering system",
  syntax: 'filter [subcommand] (parameters)',
  example: 'filter add badword',
  permission: "manage_guild",
  isGroupCommand: true,
  run: async (client, message, args) => {

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return embeds.deny(message, 'I need **Manage Guild** permission to manage AutoMod rules');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'filter');
    }

    const category = args[0].toLowerCase();
    const subcommand = args[1] ? args[1].toLowerCase() : null;

    try {
      switch (category) {
        case 'invites':
        case 'invite': {
          const subcommandInfo = {
            description: 'Manage invite link filtering',
            syntax: '{guildprefix}filter invites [on/off]',
            aliases: [],
            parameters: ['on/off'],
            example: '{guildprefix}filter invites on'
          };
          return await handleInvitesCategory(message, subcommand, args.slice(2));
        }
        case 'links':
        case 'link': {
          if (!subcommand) {
            return runHelpCommand(message, 'filter');
          }
          
          switch (subcommand) {
            case 'on':
              return await handleLinksToggle(message, true);
            case 'off':
              return await handleLinksToggle(message, false);
            case 'exempt':
              return await handleLinksExempt(message, args.slice(2));
            default:
              return runHelpCommand(message, 'filter');
          }
        }
        case 'add': {
          const subcommandInfo = {
            description: 'Add a word to the filter',
            syntax: '{guildprefix}filter add [word]',
            aliases: [],
            parameters: ['word'],
            example: '{guildprefix}filter add badword'
          };
          return await handleWordsAdd(message, args.slice(1));
        }
        case 'remove': {
          const subcommandInfo = {
            description: 'Remove a word from the filter',
            syntax: '{guildprefix}filter remove [word]',
            aliases: [],
            parameters: ['word'],
            example: '{guildprefix}filter remove badword'
          };
          return await handleWordsRemove(message, args.slice(1));
        }
        case 'list': {
          const subcommandInfo = {
            description: 'List all filtered words',
            syntax: '{guildprefix}filter list',
            aliases: [],
            parameters: [],
            example: '{guildprefix}filter list'
          };
          return await handleWordsList(message);
        }
        case 'reset': {
          const subcommandInfo = {
            description: 'Reset the word filter',
            syntax: '{guildprefix}filter reset',
            aliases: [],
            parameters: [],
            example: '{guildprefix}filter reset'
          };
          return await handleWordsReset(message);
        }
        case 'exempt': {
          const subcommandInfo = {
            description: 'Manage filter exempt list',
            syntax: '{guildprefix}filter exempt [role/user/channel]',
            aliases: [],
            parameters: ['role', 'user', 'channel'],
            example: '{guildprefix}filter exempt @Moderator'
          };
          return await handleWordsExempt(message, subcommand, args.slice(2));
        }
        case 'massmention':
        case 'mentions': {
          const subcommandInfo = {
            description: 'Manage mass mention filtering with custom threshold',
            syntax: '{guildprefix}filter massmention [on/off] --threshold [num] --do [action]',
            aliases: ['mentions'],
            parameters: ['on/off', '--threshold', '--do'],
            example: '{guildprefix}filter massmention on --threshold 10 --do mute 5m'
          };
          return await handleMassMentionCategory(message, subcommand, args.slice(2));
        }
        case 'spam': {
          const subcommandInfo = {
            description: 'Manage spam filtering with custom actions',
            syntax: '{guildprefix}filter spam [on/off] --threshold [num] --do [action]',
            aliases: [],
            parameters: ['on/off', '--threshold', '--do'],
            example: '{guildprefix}filter spam on --threshold 5 --do mute 10m'
          };
          return await handleSpamCategory(message, subcommand, args.slice(2));
        }
        default:
          return runHelpCommand(message, 'filter');
      }
    } catch (error) {
      throw error;
    }
  }
};

// Category handlers

async function handleInvitesCategory(message, subcommand, args) {
  if (!subcommand) {
    return runHelpCommand(message, 'filter');
  }

  switch (subcommand) {
    case 'on':
      return await handleInvitesToggle(message, true);
    case 'off':
      return await handleInvitesToggle(message, false);
    case 'exempt':
      return await handleInvitesExempt(message, args);
    default:
      return runHelpCommand(message, 'filter');
  }
}

async function handleLinksCategory(message, subcommand, args) {
  if (!subcommand) {
    return runHelpCommand(message, 'filter');
  }

  switch (subcommand) {
    case 'on':
      return await handleLinksToggle(message, true);
    case 'off':
      return await handleLinksToggle(message, false);
    case 'exempt':
      return await handleLinksExempt(message, args);
    case 'whitelist':
      return await handleLinksWhitelist(message, args);
    default:
      return runHelpCommand(message, 'filter');
  }
}

// Word filter functions

async function handleWordsAdd(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a word to add to the filter');
  }

  const keyword = args.join(' ').toLowerCase();

  if (keyword.length > 60) {
    return embeds.warn(message, 'Keywords cannot be longer than 60 characters');
  }

  // Get or create AutoMod rule
  const rule = await getOrCreateAutoModRule(message.guild);
  if (!rule) {
    return embeds.deny(message, 'Failed to create or access AutoMod rule');
  }

  // Check if keyword already exists
  const currentKeywords = rule.triggerMetadata.keywordFilter || [];
  if (currentKeywords.includes(keyword)) {
    return embeds.warn(message, `The word **${keyword}** is already in the filter`);
  }

  // Add keyword and update rule
  const newKeywords = [...currentKeywords, keyword];

  try {
    await rule.edit({
      triggerMetadata: {
        keywordFilter: newKeywords
      }
    });

    return embeds.success(message, `Added **${keyword}** to the word filter`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update AutoMod rule');
  }
}

async function handleWordsRemove(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a word to remove from the filter');
  }

  const keyword = args.join(' ').toLowerCase();

  // Get AutoMod rule
  const rule = await getAutoModRule(message.guild);
  if (!rule) {
    return embeds.warn(message, 'No word filter found');
  }

  // Check if keyword exists
  const currentKeywords = rule.triggerMetadata.keywordFilter || [];
  if (!currentKeywords.includes(keyword)) {
    return embeds.warn(message, `The word **${keyword}** is not in the filter`);
  }

  // Remove keyword and update rule
  const newKeywords = currentKeywords.filter(word => word !== keyword);

  try {
    if (newKeywords.length === 0) {
      // Delete rule if no keywords left
      await rule.delete('No keywords remaining');
      return embeds.success(message, `Removed **${keyword}** from the word filter. Filter disabled as no keywords remain.`);
    } else {
      // Update rule with remaining keywords
      await rule.edit({
        triggerMetadata: {
          keywordFilter: newKeywords
        }
      });
      return embeds.success(message, `Removed **${keyword}** from the word filter`);
    }
  } catch (error) {
    return embeds.deny(message, 'Failed to update AutoMod rule');
  }
}

async function handleWordsList(message) {
  const rule = await getAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No word filter found');
  }

  const keywords = rule.triggerMetadata.keywordFilter || [];

  if (keywords.length === 0) {
    return embeds.warn(message, 'No words in filter');
  }

  const keywordList = keywords.map((word, index) => {
    const wordNumber = (index + 1).toString().padStart(2, '0');
    return `\`${wordNumber}\` **${word}**`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Word Filter')
    .setDescription(keywordList)
    .setFooter({ text: `${keywords.length} filtered word${keywords.length === 1 ? '' : 's'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleWordsReset(message) {
  const rule = await getAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No word filter found');
  }

  const keywords = rule.triggerMetadata.keywordFilter || [];

  if (keywords.length === 0) {
    return embeds.warn(message, 'No words in filter to reset');
  }

  try {
    // Delete rule since no keywords will remain
    await rule.delete('Word filter reset by user');
    return embeds.success(message, `Reset word filter - removed **${keywords.length}** word${keywords.length === 1 ? '' : 's'}`);
  } catch (error) {
    return embeds.deny(message, 'Failed to reset word filter');
  }
}

async function handleWordsExempt(message, subcommand, args) {
  if (!subcommand) {
    return runHelpCommand(message, 'filter');
  }

  if (subcommand === 'list') {
    return await handleWordsExemptList(message);
  }

  // Handle exempt toggle
  const allArgs = [subcommand, ...args];
  return await handleWordsToggleExempt(message, allArgs);
}

async function handleWordsExemptList(message) {
  const rule = await getAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No word filter found');
  }

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No exempted roles, users, or channels found for word filter');
  }

  let description = '';
  let totalCount = 0;

  if (exemptRoles.length > 0) {
    description += '**Roles:**\n';
    const roleList = exemptRoles.map((roleId, index) => {
      const role = message.guild.roles.cache.get(roleId);
      const roleNumber = (index + 1).toString().padStart(2, '0');
      return role ? `\`${roleNumber}\` **${role.name}**` : `\`${roleNumber}\` \`Deleted Role\``;
    }).join('\n');
    description += roleList;
    totalCount += exemptRoles.length;
  }

  if (exemptUsers.length > 0) {
    if (description) description += '\n\n';
    description += '**Users:**\n';
    const userList = exemptUsers.map((userId, index) => {
      const member = message.guild.members.cache.get(userId);
      const userNumber = (index + 1).toString().padStart(2, '0');
      return member ? `\`${userNumber}\` **${member.displayName}**` : `\`${userNumber}\` \`Unknown User\``;
    }).join('\n');
    description += userList;
    totalCount += exemptUsers.length;
  }

  if (exemptChannels.length > 0) {
    if (description) description += '\n\n';
    description += '**Channels:**\n';
    const channelList = exemptChannels.map((channelId, index) => {
      const channel = message.guild.channels.cache.get(channelId);
      const channelNumber = (index + 1).toString().padStart(2, '0');
      return channel ? `\`${channelNumber}\` **${channel.name}**` : `\`${channelNumber}\` \`Deleted Channel\``;
    }).join('\n');
    description += channelList;
    totalCount += exemptChannels.length;
  }

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Word Filter - Exempted List')
    .setDescription(description)
    .setFooter({ text: `${totalCount} total exempted entr${totalCount === 1 ? 'y' : 'ies'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleWordsToggleExempt(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a role, user, or channel to toggle exempt for');
  }

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);

  if (!target.found) {
    return embeds.warn(message, target.error);
  }

  const rule = await getAutoModRule(message.guild);
  if (!rule) {
    return embeds.warn(message, 'No word filter found. Enable word filtering first.');
  }

  const currentExemptRoles = Array.isArray(rule.exemptRoles) ? rule.exemptRoles : (rule.exemptRoles?.map(r => r) || []);
  const currentExemptUsers = Array.isArray(rule.exemptUsers) ? rule.exemptUsers : (rule.exemptUsers?.map(u => u) || []);
  const currentExemptChannels = Array.isArray(rule.exemptChannels) ? rule.exemptChannels : (rule.exemptChannels?.map(c => c) || []);

  let newExemptRoles = currentExemptRoles;
  let newExemptUsers = currentExemptUsers;
  let newExemptChannels = currentExemptChannels;
  let action;

  if (target.type === 'role') {
    const isCurrentlyExempt = currentExemptRoles.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptRoles = currentExemptRoles.filter(roleId => roleId !== target.id);
      action = 'removed from';
    } else {
      newExemptRoles = [...currentExemptRoles, target.id];
      action = 'added to';
    }
  } else if (target.type === 'user') {
    const isCurrentlyExempt = currentExemptUsers.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptUsers = currentExemptUsers.filter(userId => userId !== target.id);
      action = 'removed from';
    } else {
      newExemptUsers = [...currentExemptUsers, target.id];
      action = 'added to';
    }
  } else if (target.type === 'channel') {
    const isCurrentlyExempt = currentExemptChannels.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptChannels = currentExemptChannels.filter(channelId => channelId !== target.id);
      action = 'removed from';
    } else {
      newExemptChannels = [...currentExemptChannels, target.id];
      action = 'added to';
    }
  }

  try {
    await rule.edit({
      exemptRoles: newExemptRoles,
      exemptUsers: newExemptUsers,
      exemptChannels: newExemptChannels
    });

    return embeds.success(message, `**${target.name}** has been ${action} the word filter exempt list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update word filter rule');
  }
}

async function handleInvitesExempt(message, args) {
  if (!args[0]) {
    return runHelpCommand(message, 'filter');
  }

  if (args[0] === 'list') {
    return await handleInvitesExemptList(message);
  }

  // Handle exempt toggle
  return await handleInvitesToggleExempt(message, args);
}

async function handleInvitesExemptList(message) {
  const rule = await getInviteAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No **invite filter** found');
  }

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No exempted roles, users, or channels found for **invite filter**');
  }

  let description = '';
  let totalCount = 0;

  if (exemptRoles.length > 0) {
    description += '**Roles:**\n';
    const roleList = exemptRoles.map((roleId, index) => {
      const role = message.guild.roles.cache.get(roleId);
      const roleNumber = (index + 1).toString().padStart(2, '0');
      return role ? `\`${roleNumber}\` **${role.name}**` : `\`${roleNumber}\` \`Deleted Role\``;
    }).join('\n');
    description += roleList;
    totalCount += exemptRoles.length;
  }

  if (exemptUsers.length > 0) {
    if (description) description += '\n\n';
    description += '**Users:**\n';
    const userList = exemptUsers.map((userId, index) => {
      const member = message.guild.members.cache.get(userId);
      const userNumber = (index + 1).toString().padStart(2, '0');
      return member ? `\`${userNumber}\` **${member.displayName}**` : `\`${userNumber}\` \`Unknown User\``;
    }).join('\n');
    description += userList;
    totalCount += exemptUsers.length;
  }

  if (exemptChannels.length > 0) {
    if (description) description += '\n\n';
    description += '**Channels:**\n';
    const channelList = exemptChannels.map((channelId, index) => {
      const channel = message.guild.channels.cache.get(channelId);
      const channelNumber = (index + 1).toString().padStart(2, '0');
      return channel ? `\`${channelNumber}\` **${channel.name}**` : `\`${channelNumber}\` \`Deleted Channel\``;
    }).join('\n');
    description += channelList;
    totalCount += exemptChannels.length;
  }

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Invite Filter - Exempted List')
    .setDescription(description)
    .setFooter({ text: `${totalCount} total exempted entr${totalCount === 1 ? 'y' : 'ies'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleInvitesToggleExempt(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a role, user, or channel to toggle exempt for');
  }

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);

  if (!target.found) {
    return embeds.warn(message, target.error);
  }

  const rule = await getInviteAutoModRule(message.guild);
  if (!rule) {
    return embeds.warn(message, 'No **invite filter** found. Enable **invite filtering** first.');
  }

  const currentExemptRoles = Array.isArray(rule.exemptRoles) ? rule.exemptRoles : (rule.exemptRoles?.map(r => r) || []);
  const currentExemptUsers = Array.isArray(rule.exemptUsers) ? rule.exemptUsers : (rule.exemptUsers?.map(u => u) || []);
  const currentExemptChannels = Array.isArray(rule.exemptChannels) ? rule.exemptChannels : (rule.exemptChannels?.map(c => c) || []);

  let newExemptRoles = currentExemptRoles;
  let newExemptUsers = currentExemptUsers;
  let newExemptChannels = currentExemptChannels;
  let action;

  if (target.type === 'role') {
    const isCurrentlyExempt = currentExemptRoles.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptRoles = currentExemptRoles.filter(roleId => roleId !== target.id);
      action = 'removed from';
    } else {
      newExemptRoles = [...currentExemptRoles, target.id];
      action = 'added to';
    }
  } else if (target.type === 'user') {
    const isCurrentlyExempt = currentExemptUsers.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptUsers = currentExemptUsers.filter(userId => userId !== target.id);
      action = 'removed from';
    } else {
      newExemptUsers = [...currentExemptUsers, target.id];
      action = 'added to';
    }
  } else if (target.type === 'channel') {
    const isCurrentlyExempt = currentExemptChannels.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptChannels = currentExemptChannels.filter(channelId => channelId !== target.id);
      action = 'removed from';
    } else {
      newExemptChannels = [...currentExemptChannels, target.id];
      action = 'added to';
    }
  }

  try {
    await rule.edit({
      exemptRoles: newExemptRoles,
      exemptUsers: newExemptUsers,
      exemptChannels: newExemptChannels
    });

    return embeds.success(message, `**${target.name}** has been ${action} the **invite filter** exempt list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update **invite filter** rule');
  }
}

async function handleInvitesToggle(message, enable) {
  const rule = await getInviteAutoModRule(message.guild);

  if (enable) {
    if (rule) {
      return embeds.warn(message, '**Invite filter** is already **enabled**');
    }

    // Create invite filter rule
    const result = await createInviteAutoModRule(message.guild);
    if (result.success) {
      return embeds.success(message, '**Invite filter** has been **enabled**');
    } else {
      return embeds.deny(message, result.message);
    }
  } else {
    if (!rule) {
      return embeds.warn(message, '**Invite filter** is already **disabled**');
    }

    try {
      await rule.delete('Invite filter disabled by user');
      return embeds.success(message, '**Invite filter** has been **disabled**');
    } catch (error) {
      return embeds.deny(message, 'Failed to disable **invite filter**');
    }
  }
}

async function handleLinksToggle(message, enable) {
  const rule = await getLinksAutoModRule(message.guild);

  if (enable) {
    if (rule) {
      return embeds.warn(message, '**Links filter** is already **enabled**');
    }

    // Create links filter rule
    const result = await createLinksAutoModRule(message.guild);
    if (result.success) {
      return embeds.success(message, '**Links filter** has been **enabled**');
    } else {
      return embeds.deny(message, result.message);
    }
  } else {
    if (!rule) {
      return embeds.warn(message, '**Links filter** is already **disabled**');
    }

    try {
      await rule.delete('Links filter disabled by user');
      return embeds.success(message, '**Links filter** has been **disabled**');
    } catch (error) {
      return embeds.deny(message, 'Failed to disable **links filter**');
    }
  }
}

async function handleLinksExempt(message, args) {
  if (!args[0]) {
    return runHelpCommand(message, 'filter');
  }

  if (args[0] === 'list') {
    return await handleLinksExemptList(message);
  }

  // Handle exempt toggle
  return await handleLinksToggleExempt(message, args);
}

async function handleLinksExemptList(message) {
  const rule = await getLinksAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No **links filter** found');
  }

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No exempted roles, users, or channels found for **links filter**');
  }

  let description = '';
  let totalCount = 0;

  if (exemptRoles.length > 0) {
    description += '**Roles:**\n';
    const roleList = exemptRoles.map((roleId, index) => {
      const role = message.guild.roles.cache.get(roleId);
      const roleNumber = (index + 1).toString().padStart(2, '0');
      return role ? `\`${roleNumber}\` **${role.name}**` : `\`${roleNumber}\` \`Deleted Role\``;
    }).join('\n');
    description += roleList;
    totalCount += exemptRoles.length;
  }

  if (exemptUsers.length > 0) {
    if (description) description += '\n\n';
    description += '**Users:**\n';
    const userList = exemptUsers.map((userId, index) => {
      const member = message.guild.members.cache.get(userId);
      const userNumber = (index + 1).toString().padStart(2, '0');
      return member ? `\`${userNumber}\` **${member.displayName}**` : `\`${userNumber}\` \`Unknown User\``;
    }).join('\n');
    description += userList;
    totalCount += exemptUsers.length;
  }

  if (exemptChannels.length > 0) {
    if (description) description += '\n\n';
    description += '**Channels:**\n';
    const channelList = exemptChannels.map((channelId, index) => {
      const channel = message.guild.channels.cache.get(channelId);
      const channelNumber = (index + 1).toString().padStart(2, '0');
      return channel ? `\`${channelNumber}\` **${channel.name}**` : `\`${channelNumber}\` \`Deleted Channel\``;
    }).join('\n');
    description += channelList;
    totalCount += exemptChannels.length;
  }

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Links Filter - Exempted List')
    .setDescription(description)
    .setFooter({ text: `${totalCount} total exempted entr${totalCount === 1 ? 'y' : 'ies'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleLinksToggleExempt(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a role, user, or channel to toggle exempt for');
  }

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);

  if (!target.found) {
    return embeds.warn(message, target.error);
  }

  const rule = await getLinksAutoModRule(message.guild);
  if (!rule) {
    return embeds.warn(message, 'No **links filter** found. Enable **links filtering** first.');
  }

  const currentExemptRoles = Array.isArray(rule.exemptRoles) ? rule.exemptRoles : (rule.exemptRoles?.map(r => r) || []);
  const currentExemptUsers = Array.isArray(rule.exemptUsers) ? rule.exemptUsers : (rule.exemptUsers?.map(u => u) || []);
  const currentExemptChannels = Array.isArray(rule.exemptChannels) ? rule.exemptChannels : (rule.exemptChannels?.map(c => c) || []);

  let newExemptRoles = currentExemptRoles;
  let newExemptUsers = currentExemptUsers;
  let newExemptChannels = currentExemptChannels;
  let action;

  if (target.type === 'role') {
    const isCurrentlyExempt = currentExemptRoles.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptRoles = currentExemptRoles.filter(roleId => roleId !== target.id);
      action = 'removed from';
    } else {
      newExemptRoles = [...currentExemptRoles, target.id];
      action = 'added to';
    }
  } else if (target.type === 'user') {
    const isCurrentlyExempt = currentExemptUsers.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptUsers = currentExemptUsers.filter(userId => userId !== target.id);
      action = 'removed from';
    } else {
      newExemptUsers = [...currentExemptUsers, target.id];
      action = 'added to';
    }
  } else if (target.type === 'channel') {
    const isCurrentlyExempt = currentExemptChannels.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptChannels = currentExemptChannels.filter(channelId => channelId !== target.id);
      action = 'removed from';
    } else {
      newExemptChannels = [...currentExemptChannels, target.id];
      action = 'added to';
    }
  }

  try {
    await rule.edit({
      exemptRoles: newExemptRoles,
      exemptUsers: newExemptUsers,
      exemptChannels: newExemptChannels
    });

    return embeds.success(message, `**${target.name}** has been ${action} the **links filter** exempt list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update **links filter** rule');
  }
}

// Helper function to find either a role, user, or channel
async function findRoleUserOrChannel(message, input) {
  // Check for channel mention first
  const mentionedChannel = message.mentions.channels.first();
  if (mentionedChannel && mentionedChannel.guild.id === message.guild.id) {
    return {
      found: true,
      type: 'channel',
      id: mentionedChannel.id,
      name: mentionedChannel.name,
      object: mentionedChannel
    };
  }

  // Check for role mention
  const mentionedRole = message.mentions.roles.first();
  if (mentionedRole && mentionedRole.guild.id === message.guild.id) {
    return {
      found: true,
      type: 'role',
      id: mentionedRole.id,
      name: mentionedRole.name,
      object: mentionedRole
    };
  }

  // Check for user mention
  if (message.mentions.users.first()) {
    const user = message.mentions.users.first();
    const member = message.guild.members.cache.get(user.id);
    return {
      found: true,
      type: 'user',
      id: user.id,
      name: member ? member.displayName : user.username,
      object: member || user
    };
  }

  // Try to find channel first
  const channelResult = message.guild.channels.cache.find(ch =>
    ch.name.toLowerCase().includes(input.toLowerCase()) ||
    ch.id === input
  );
  if (channelResult) {
    return {
      found: true,
      type: 'channel',
      id: channelResult.id,
      name: channelResult.name,
      object: channelResult
    };
  }

  // Try to find role
  const roleResult = findRole(message.guild, input);
  if (roleResult.found) {
    return {
      found: true,
      type: 'role',
      id: roleResult.role.id,
      name: roleResult.role.name,
      object: roleResult.role
    };
  }

  // Try to find user
  const userResult = await findUser(message.guild, input, message.client);
  if (userResult.found) {
    const user = userResult.user;
    return {
      found: true,
      type: 'user',
      id: user.id,
      name: user.displayName || user.username,
      object: user
    };
  }

  // None found
  return {
    found: false,
    error: `I was unable to find a role, user, or channel with the name: ${input}`
  };
}

// Helper function to get existing AutoMod rule
async function getAutoModRule(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.find(rule => rule.name === 'adore AutoMod') || null;
  } catch (error) {
    return null;
  }
}

// Helper function to get existing invite AutoMod rule
async function getInviteAutoModRule(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.find(rule => rule.name === 'adore Invites') || null;
  } catch (error) {
    return null;
  }
}

// Helper function to get existing links AutoMod rule
async function getLinksAutoModRule(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.find(rule => rule.name === 'adore Links') || null;
  } catch (error) {
    return null;
  }
}

// Helper function to get existing mass mention AutoMod rule
async function getMassMentionAutoModRule(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.find(rule => rule.name === 'adore Mentions') || null;
  } catch (error) {
    return null;
  }
}

// Helper function to get or create AutoMod rule
async function getOrCreateAutoModRule(guild) {
  try {
    // Try to find existing rule first
    let rule = await getAutoModRule(guild);

    if (!rule) {
      // Create new rule
      const ruleData = {
        name: 'adore AutoMod',
        eventType: 1, // MESSAGE_SEND
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          keywordFilter: []
        },
        actions: [
          {
            type: AutoModerationActionType.BlockMessage,
            metadata: {
              customMessage: 'The message is blocked by adore automod'
            }
          }
        ],
        enabled: true,
        exemptRoles: [],
        exemptUsers: [],
        exemptChannels: []
      };

      rule = await guild.autoModerationRules.create(ruleData);
    }

    return rule;
  } catch (error) {
    logger.webhook.error(error);

    // Check for specific AutoMod rule limit error
    if (error.code === 50035 && error.rawError?.errors?._errors?.some(e =>
      e.code === 'AUTO_MODERATION_MAX_RULES_OF_TYPE_EXCEEDED'
    )) {
    }

    return null;
  }
}

// Helper function to create invite AutoMod rule
async function createInviteAutoModRule(guild) {
  try {
    const ruleData = {
      name: 'adore Invites',
      eventType: 1, // MESSAGE_SEND
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: {
        regexPatterns: ['(?:https?:\\/\\/)?(?:www\\.|ptb\\.|canary\\.)?discord(?:app)?\\.(?:(?:com|gg)[\\/\\\\]+(?:invite|servers)[\\/\\\\]+[a-z0-9\\-_]+)|discord\\.gg[\\/\\\\]+[a-z0-9\\-_]+']
      },
      actions: [
        {
          type: AutoModerationActionType.BlockMessage,
          metadata: {
            customMessage: 'The message is blocked by adore automod'
          }
        }
      ],
      enabled: true,
      exemptRoles: [],
      exemptUsers: [],
      exemptChannels: []
    };

    await guild.autoModerationRules.create(ruleData);
    return { success: true };
  } catch (error) {
    logger.webhook.error(error);

    // Check for specific AutoMod rule limit error
    if (error.code === 50035 && error.rawError?.errors?._errors?.some(e =>
      e.code === 'AUTO_MODERATION_MAX_RULES_OF_TYPE_EXCEEDED'
    )) {
      return {
        success: false,
        error: 'RULE_LIMIT_EXCEEDED',
        message: 'Cannot create invite filter - Discord\'s AutoMod rule limit (6 rules) has been reached. Please delete some existing AutoMod rules first.'
      };
    }

    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: 'Failed to create invite filter rule. Please try again later.'
    };
  }
}

// Helper function to create links AutoMod rule
async function createLinksAutoModRule(guild) {
  try {
    const ruleData = {
      name: 'adore Links',
      eventType: 1, // MESSAGE_SEND
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: {
        regexPatterns: ['(?:https?://?)?(\\S*@)?[\\\\a-z0-9_\\-\\.\\%]*[a-z0-9_\\-%]+(\\.|\%2e)[a-z(\%[a-z0-9])]{2,}']
      },
      actions: [
        {
          type: AutoModerationActionType.BlockMessage,
          metadata: {
            customMessage: 'The message is blocked by adore automod'
          }
        }
      ],
      enabled: true,
      exemptRoles: [],
      exemptUsers: [],
      exemptChannels: []
    };

    await guild.autoModerationRules.create(ruleData);
    return { success: true };
  } catch (error) {
    logger.webhook.error(error);

    // Check for specific AutoMod rule limit error
    if (error.code === 50035 && error.rawError?.errors?._errors?.some(e =>
      e.code === 'AUTO_MODERATION_MAX_RULES_OF_TYPE_EXCEEDED'
    )) {
      return {
        success: false,
        error: 'RULE_LIMIT_EXCEEDED',
        message: 'Cannot create links filter - Discord\'s AutoMod rule limit (6 rules) has been reached. Please delete some existing AutoMod rules first.'
      };
    }

    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: 'Failed to create links filter rule. Please try again later.'
    };
  }
}

// Helper function to create mass mention AutoMod rule
async function createMassMentionAutoModRule(guild, threshold = 5) {
  try {
    const ruleData = {
      name: 'adore Mentions',
      eventType: 1, // MESSAGE_SEND
      triggerType: AutoModerationRuleTriggerType.MentionSpam,
      triggerMetadata: {
        mentionTotalLimit: threshold // Block messages with more than X mentions
      },
      actions: [
        {
          type: AutoModerationActionType.BlockMessage,
          metadata: {
            customMessage: 'The message is blocked by adore automod'
          }
        }
      ],
      enabled: true,
      exemptRoles: [],
      exemptUsers: [],
      exemptChannels: []
    };

    await guild.autoModerationRules.create(ruleData);
    return { success: true };
  } catch (error) {
    logger.webhook.error(error);

    // Check for specific AutoMod rule limit error
    if (error.code === 50035 && error.rawError?.errors?._errors?.some(e =>
      e.code === 'AUTO_MODERATION_MAX_RULES_OF_TYPE_EXCEEDED'
    )) {
      return {
        success: false,
        error: 'RULE_LIMIT_EXCEEDED',
        message: 'Cannot create mass mention filter - Discord\'s AutoMod rule limit (6 rules) has been reached. Please delete some existing AutoMod rules first.'
      };
    }

    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: 'Failed to create mass mention filter rule. Please try again later.'
    };
  }
}

// ===== MASS MENTION FILTER =====

async function handleMassMentionCategory(message, subcommand, args) {
  if (!subcommand) {
    return runHelpCommand(message, 'filter');
  }

  switch (subcommand) {
    case 'on':
      return await handleMassMentionToggle(message, true, args);
    case 'off':
      return await handleMassMentionToggle(message, false, args);
    case 'exempt':
      return await handleMassMentionExempt(message, args);
    default:
      return runHelpCommand(message, 'filter');
  }
}

async function handleMassMentionToggle(message, enable, args = []) {
  const rule = await getMassMentionAutoModRule(message.guild);

  if (enable) {
    // Parse optional --threshold parameter
    let threshold = 5; // Default threshold
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--threshold' && args[i + 1]) {
        const parsedThreshold = parseInt(args[i + 1]);
        if (parsedThreshold && parsedThreshold > 0 && parsedThreshold <= 50) {
          threshold = parsedThreshold;
        } else {
          return embeds.warn(message, 'Threshold must be between 1 and 50');
        }
        break;
      }
    }

    if (rule) {
      // Update existing rule with new threshold
      try {
        await rule.edit({
          triggerMetadata: {
            mentionTotalLimit: threshold
          }
        });
        return embeds.success(message, `**Mass mention filter** threshold updated to **${threshold} mentions**`);
      } catch (error) {
        return embeds.deny(message, 'Failed to update **mass mention filter** threshold');
      }
    }

    // Create mass mention filter rule
    const result = await createMassMentionAutoModRule(message.guild, threshold);
    if (result.success) {
      return embeds.success(message, `**Mass mention filter** has been **enabled** (threshold: **${threshold} mentions**)`);
    } else {
      return embeds.deny(message, result.message);
    }
  } else {
    if (!rule) {
      return embeds.warn(message, '**Mass mention filter** is already **disabled**');
    }

    try {
      await rule.delete('Mass mention filter disabled by user');
      return embeds.success(message, '**Mass mention filter** has been **disabled**');
    } catch (error) {
      return embeds.deny(message, 'Failed to disable **mass mention filter**');
    }
  }
}

async function handleMassMentionExempt(message, args) {
  if (!args[0]) {
    return runHelpCommand(message, 'filter');
  }

  if (args[0] === 'list') {
    return await handleMassMentionExemptList(message);
  }

  return await handleMassMentionToggleExempt(message, args);
}

async function handleMassMentionExemptList(message) {
  const rule = await getMassMentionAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No **mass mention filter** found');
  }

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No exempted roles, users, or channels found for **mass mention filter**');
  }

  let description = '';
  let totalCount = 0;

  if (exemptRoles.length > 0) {
    description += '**Roles:**\n';
    const roleList = exemptRoles.map((roleId, index) => {
      const role = message.guild.roles.cache.get(roleId);
      const roleNumber = (index + 1).toString().padStart(2, '0');
      return role ? `\`${roleNumber}\` **${role.name}**` : `\`${roleNumber}\` \`Deleted Role\``;
    }).join('\n');
    description += roleList;
    totalCount += exemptRoles.length;
  }

  if (exemptUsers.length > 0) {
    if (description) description += '\n\n';
    description += '**Users:**\n';
    const userList = exemptUsers.map((userId, index) => {
      const member = message.guild.members.cache.get(userId);
      const userNumber = (index + 1).toString().padStart(2, '0');
      return member ? `\`${userNumber}\` **${member.displayName}**` : `\`${userNumber}\` \`Unknown User\``;
    }).join('\n');
    description += userList;
    totalCount += exemptUsers.length;
  }

  if (exemptChannels.length > 0) {
    if (description) description += '\n\n';
    description += '**Channels:**\n';
    const channelList = exemptChannels.map((channelId, index) => {
      const channel = message.guild.channels.cache.get(channelId);
      const channelNumber = (index + 1).toString().padStart(2, '0');
      return channel ? `\`${channelNumber}\` **${channel.name}**` : `\`${channelNumber}\` \`Deleted Channel\``;
    }).join('\n');
    description += channelList;
    totalCount += exemptChannels.length;
  }

  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Mass Mention Filter - Exempted List')
    .setDescription(description)
    .setFooter({ text: `${totalCount} total exempted entr${totalCount === 1 ? 'y' : 'ies'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleMassMentionToggleExempt(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a role, user, or channel to toggle exempt for');
  }

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);

  if (!target.found) {
    return embeds.warn(message, target.error);
  }

  const rule = await getMassMentionAutoModRule(message.guild);
  if (!rule) {
    return embeds.warn(message, 'No **mass mention filter** found. Enable **mass mention filtering** first.');
  }

  const currentExemptRoles = Array.isArray(rule.exemptRoles) ? rule.exemptRoles : (rule.exemptRoles?.map(r => r) || []);
  const currentExemptUsers = Array.isArray(rule.exemptUsers) ? rule.exemptUsers : (rule.exemptUsers?.map(u => u) || []);
  const currentExemptChannels = Array.isArray(rule.exemptChannels) ? rule.exemptChannels : (rule.exemptChannels?.map(c => c) || []);

  let newExemptRoles = currentExemptRoles;
  let newExemptUsers = currentExemptUsers;
  let newExemptChannels = currentExemptChannels;
  let action;

  if (target.type === 'role') {
    const isCurrentlyExempt = currentExemptRoles.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptRoles = currentExemptRoles.filter(roleId => roleId !== target.id);
      action = 'removed from';
    } else {
      newExemptRoles = [...currentExemptRoles, target.id];
      action = 'added to';
    }
  } else if (target.type === 'user') {
    const isCurrentlyExempt = currentExemptUsers.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptUsers = currentExemptUsers.filter(userId => userId !== target.id);
      action = 'removed from';
    } else {
      newExemptUsers = [...currentExemptUsers, target.id];
      action = 'added to';
    }
  } else if (target.type === 'channel') {
    const isCurrentlyExempt = currentExemptChannels.includes(target.id);
    if (isCurrentlyExempt) {
      newExemptChannels = currentExemptChannels.filter(channelId => channelId !== target.id);
      action = 'removed from';
    } else {
      newExemptChannels = [...currentExemptChannels, target.id];
      action = 'added to';
    }
  }

  try {
    await rule.edit({
      exemptRoles: newExemptRoles,
      exemptUsers: newExemptUsers,
      exemptChannels: newExemptChannels
    });

    return embeds.success(message, `**${target.name}** has been ${action} the **mass mention filter** exempt list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update **mass mention filter** rule');
  }
}

// ===== SPAM FILTER =====

async function handleSpamCategory(message, subcommand, args) {
  if (!subcommand) {
    return runHelpCommand(message, 'filter');
  }

  if (subcommand === 'on') {
    const subcommandInfo = {
      description: 'Enable spam filter with custom settings',
      syntax: '{guildprefix}filter spam on --threshold [num] --do [delete/mute/jail]',
      aliases: [],
      parameters: ['--threshold', '--do'],
      example: '{guildprefix}filter spam on --threshold 5 --do mute 10m'
    };
    return await handleSpamToggle(message, 'all', true, args);
  }

  if (subcommand === 'off') {
    const subcommandInfo = {
      description: 'Disable spam filter',
      syntax: '{guildprefix}filter spam off',
      aliases: [],
      parameters: [],
      example: '{guildprefix}filter spam off'
    };
    return await handleSpamToggle(message, 'all', false, args);
  }

  if (subcommand === 'channel') {
    const subcommandInfo = {
      description: 'Enable/disable spam filter for specific channel',
      syntax: '{guildprefix}filter spam channel [#channel] [on/off] --threshold [num] --do [action]',
      aliases: [],
      parameters: ['channel', 'on/off', '--threshold', '--do'],
      example: '{guildprefix}filter spam channel #general on --threshold 7 --do jail'
    };
    const toggle = args[1]?.toLowerCase();
    if (toggle === 'on' || toggle === 'off') {
      return await handleSpamToggle(message, 'channel', toggle === 'on', args.slice(2));
    }
    return runHelpCommand(message, 'filter');
  }

  if (subcommand === 'exempt') {
    const subcommandInfo = {
      description: 'Exempt role or channel from spam filter',
      syntax: '{guildprefix}filter spam exempt [@role/#channel]',
      aliases: [],
      parameters: ['role/channel'],
      example: '{guildprefix}filter spam exempt @Moderator'
    };
    return await handleSpamExempt(message, args);
  }

  return runHelpCommand(message, 'filter');
}

async function handleSpamToggle(message, target, enable, args) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const { findChannel } = require('../../../handlers/finder');
  const ms = require('ms');

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    
    if (!guildData.SpamFilter) {
      guildData.SpamFilter = {
        enabled: false,
        channels: [],
        exemptRoles: [],
        threshold: 5,
        action: 'delete',
        duration: null
      };
    }

    // Parse optional parameters (--threshold, --do)
    let threshold = guildData.SpamFilter.threshold || 5;
    let action = guildData.SpamFilter.action || 'delete';
    let duration = guildData.SpamFilter.duration || null;

    // Parse args for flags
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--threshold' && args[i + 1]) {
        const parsedThreshold = parseInt(args[i + 1]);
        if (parsedThreshold && parsedThreshold > 0 && parsedThreshold <= 20) {
          threshold = parsedThreshold;
          i++; // Skip next arg
        }
      } else if (args[i] === '--do' && args[i + 1]) {
        const actionArg = args[i + 1].toLowerCase();
        if (actionArg === 'delete' || actionArg === 'jail') {
          action = actionArg;
          i++; // Skip next arg
        } else if (actionArg === 'mute' && args[i + 2]) {
          action = 'mute';
          const parsedDuration = ms(args[i + 2]);
          if (parsedDuration && parsedDuration > 0) {
            duration = args[i + 2];
            i += 2; // Skip next 2 args
          } else {
            return embeds.warn(message, 'Invalid duration format. Example: `10m`, `1h`, `30s`');
          }
        }
      }
    }

    if (target === 'all') {
      guildData.SpamFilter.enabled = enable;
      guildData.SpamFilter.channels = [];
      
      if (enable) {
        guildData.SpamFilter.threshold = threshold;
        guildData.SpamFilter.action = action;
        guildData.SpamFilter.duration = duration;
      }
      
      await guildService.set(message.guild.id, guildData);
      
      let statusMsg = `Spam filter has been **${enable ? 'enabled' : 'disabled'}** for **all channels**`;
      if (enable) {
        statusMsg += `\n**Threshold:** ${threshold} messages in 5 seconds\n**Action:** ${action}`;
        if (action === 'mute' && duration) {
          statusMsg += ` for ${duration}`;
        }
      }
      
      return embeds.success(message, statusMsg);
    } else if (target === 'channel') {
      if (!args[0]) {
        return embeds.warn(message, 'Please specify a channel');
      }

      const channelResult = findChannel(message.guild, args[0]);
      if (!channelResult.found) {
        return embeds.warn(message, channelResult.error);
      }

      const channel = channelResult.channel;
      const channels = guildData.SpamFilter.channels || [];

      if (enable) {
        if (channels.includes(channel.id)) {
          return embeds.warn(message, `Spam filter is already enabled for ${channel}`);
        }
        channels.push(channel.id);
        guildData.SpamFilter.channels = channels;
        guildData.SpamFilter.enabled = true;
        guildData.SpamFilter.threshold = threshold;
        guildData.SpamFilter.action = action;
        guildData.SpamFilter.duration = duration;
        
        await guildService.set(message.guild.id, guildData);
        
        let statusMsg = `Spam filter has been **enabled** for ${channel}`;
        statusMsg += `\n**Threshold:** ${threshold} messages in 5 seconds\n**Action:** ${action}`;
        if (action === 'mute' && duration) {
          statusMsg += ` for ${duration}`;
        }
        
        return embeds.success(message, statusMsg);
      } else {
        if (!channels.includes(channel.id)) {
          return embeds.warn(message, `Spam filter is not enabled for ${channel}`);
        }
        guildData.SpamFilter.channels = channels.filter(id => id !== channel.id);
        
        await guildService.set(message.guild.id, guildData);
        
        return embeds.success(message, `Spam filter has been **disabled** for ${channel}`);
      }
    }
  } catch (error) {
    logger.webhook.error(error, 'Spam Filter Toggle', {
      user: message.author,
      guild: message.guild,
      command: 'filter spam'
    });
    return embeds.deny(message, 'Failed to update spam filter settings');
  }
}

async function handleSpamExempt(message, args) {
  if (!args[0]) {
    return runHelpCommand(message, 'filter');
  }

  if (args[0] === 'list') {
    return await handleSpamExemptList(message);
  }

  return await handleSpamToggleExempt(message, args);
}

async function handleSpamExemptList(message) {
  const { getService } = require('@services');
  const guildService = getService('guild');

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    const exemptRoles = guildData.SpamFilter?.exemptRoles || [];

    if (exemptRoles.length === 0) {
      return embeds.warn(message, 'No exempted roles found for **spam filter**');
    }

    const roleList = exemptRoles.map((roleId, index) => {
      const role = message.guild.roles.cache.get(roleId);
      const roleNumber = (index + 1).toString().padStart(2, '0');
      return role ? `\`${roleNumber}\` **${role.name}**` : `\`${roleNumber}\` \`Deleted Role\``;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle('Spam Filter - Exempted Roles')
      .setDescription(roleList)
      .setFooter({ text: `${exemptRoles.length} exempted role${exemptRoles.length === 1 ? '' : 's'}` });

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    logger.webhook.error(error, 'Spam Exempt List', {
      user: message.author,
      guild: message.guild
    });
    return embeds.deny(message, 'Failed to retrieve exempt list');
  }
}

async function handleSpamToggleExempt(message, args) {
  const { getService } = require('@services');
  const guildService = getService('guild');

  if (!args[0]) {
    return embeds.warn(message, 'Please provide a role to toggle exempt for');
  }

  const input = args.join(' ');
  const roleResult = findRole(message.guild, input);

  if (!roleResult.found) {
    return embeds.warn(message, roleResult.error);
  }

  const role = roleResult.role;

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    
    if (!guildData.SpamFilter) {
      guildData.SpamFilter = {
        enabled: false,
        channels: [],
        exemptRoles: []
      };
    }

    const exemptRoles = guildData.SpamFilter.exemptRoles || [];
    const isCurrentlyExempt = exemptRoles.includes(role.id);
    let action;

    if (isCurrentlyExempt) {
      guildData.SpamFilter.exemptRoles = exemptRoles.filter(roleId => roleId !== role.id);
      action = 'removed from';
    } else {
      guildData.SpamFilter.exemptRoles = [...exemptRoles, role.id];
      action = 'added to';
    }

    await guildService.set(message.guild.id, guildData);

    return embeds.success(message, `**${role.name}** has been ${action} the **spam filter** exempt list`);
  } catch (error) {
    logger.webhook.error(error, 'Spam Toggle Exempt', {
      user: message.author,
      guild: message.guild,
      role: role.name
    });
    return embeds.deny(message, 'Failed to update exempt list');
  }
}


