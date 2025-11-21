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
  permission: "Manage Guild",
  isGroupCommand: true,
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

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
        case 'invites': {
          const subcommandInfo = {
            description: 'Manage invite link filtering',
            usage: '{guildprefix}filter invites [on/off]',
            aliases: [],
            parameters: ['on/off'],
            example: '{guildprefix}filter invites on'
          };
          return await handleInvitesCategory(message, subcommand, args.slice(2));
        }
        case 'add': {
          const subcommandInfo = {
            description: 'Add a word to the filter',
            usage: '{guildprefix}filter add [word]',
            aliases: [],
            parameters: ['word'],
            example: '{guildprefix}filter add badword'
          };
          return await handleWordsAdd(message, args.slice(1));
        }
        case 'remove': {
          const subcommandInfo = {
            description: 'Remove a word from the filter',
            usage: '{guildprefix}filter remove [word]',
            aliases: [],
            parameters: ['word'],
            example: '{guildprefix}filter remove badword'
          };
          return await handleWordsRemove(message, args.slice(1));
        }
        case 'list': {
          const subcommandInfo = {
            description: 'List all filtered words',
            usage: '{guildprefix}filter list',
            aliases: [],
            parameters: [],
            example: '{guildprefix}filter list'
          };
          return await handleWordsList(message);
        }
        case 'reset': {
          const subcommandInfo = {
            description: 'Reset the word filter',
            usage: '{guildprefix}filter reset',
            aliases: [],
            parameters: [],
            example: '{guildprefix}filter reset'
          };
          return await handleWordsReset(message);
        }
        case 'ignore': {
          const subcommandInfo = {
            description: 'Manage filter ignore list',
            usage: '{guildprefix}filter ignore [role/user/channel]',
            aliases: [],
            parameters: ['role', 'user', 'channel'],
            example: '{guildprefix}filter ignore @Moderator'
          };
          return await handleWordsIgnore(message, subcommand, args.slice(2));
        }
        default:
          return runHelpCommand(message, 'filter');
      }
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while managing the filter. Please try again.');
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
    case 'ignore':
      return await handleInvitesIgnore(message, args);
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

async function handleWordsIgnore(message, subcommand, args) {
  if (!subcommand) {
    return runHelpCommand(message, 'filter');
  }

  if (subcommand === 'list') {
    return await handleWordsIgnoreList(message);
  }

  // Handle ignore toggle
  const allArgs = [subcommand, ...args];
  return await handleWordsToggleIgnore(message, allArgs);
}

async function handleWordsIgnoreList(message) {
  const rule = await getAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No word filter found');
  }

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No ignored roles, users, or channels found for word filter');
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
    .setTitle('Word Filter - Ignored List')
    .setDescription(description)
    .setFooter({ text: `${totalCount} total ignored entr${totalCount === 1 ? 'y' : 'ies'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleWordsToggleIgnore(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a role, user, or channel to toggle ignore for');
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

  const currentExemptRoles = rule.exemptRoles || [];
  const currentExemptUsers = rule.exemptUsers || [];
  const currentExemptChannels = rule.exemptChannels || [];

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

    return embeds.success(message, `**${target.name}** has been ${action} the word filter ignore list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update word filter rule');
  }
}

async function handleInvitesIgnore(message, args) {
  if (!args[0]) {
    return runHelpCommand(message, 'filter');
  }

  if (args[0] === 'list') {
    return await handleInvitesIgnoreList(message);
  }

  // Handle ignore toggle
  return await handleInvitesToggleIgnore(message, args);
}

async function handleInvitesIgnoreList(message) {
  const rule = await getInviteAutoModRule(message.guild);

  if (!rule) {
    return embeds.warn(message, 'No invite filter found');
  }

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No ignored roles, users, or channels found for invite filter');
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
    .setTitle('Invite Filter - Ignored List')
    .setDescription(description)
    .setFooter({ text: `${totalCount} total ignored entr${totalCount === 1 ? 'y' : 'ies'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleInvitesToggleIgnore(message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a role, user, or channel to toggle ignore for');
  }

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);

  if (!target.found) {
    return embeds.warn(message, target.error);
  }

  const rule = await getInviteAutoModRule(message.guild);
  if (!rule) {
    return embeds.warn(message, 'No invite filter found. Enable invite filtering first.');
  }

  const currentExemptRoles = rule.exemptRoles || [];
  const currentExemptUsers = rule.exemptUsers || [];
  const currentExemptChannels = rule.exemptChannels || [];

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

    return embeds.success(message, `**${target.name}** has been ${action} the invite filter ignore list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update invite filter rule');
  }
}

async function handleInvitesToggle(message, enable) {
  const rule = await getInviteAutoModRule(message.guild);

  if (enable) {
    if (rule) {
      return embeds.warn(message, 'Invite filter is already enabled');
    }

    // Create invite filter rule
    const result = await createInviteAutoModRule(message.guild);
    if (result.success) {
      return embeds.success(message, 'Invite filter has been **enabled**');
    } else {
      return embeds.deny(message, result.message);
    }
  } else {
    if (!rule) {
      return embeds.warn(message, 'Invite filter is already disabled');
    }

    try {
      await rule.delete('Invite filter disabled by user');
      return embeds.success(message, 'Invite filter has been **disabled**');
    } catch (error) {
      return embeds.deny(message, 'Failed to disable invite filter');
    }
  }
}

// Helper function to find either a role, user, or channel
async function findRoleUserOrChannel(message, input) {
  // Check for channel mention first
  if (message.mentions.channels.first()) {
    const channel = message.mentions.channels.first();
    return {
      found: true,
      type: 'channel',
      id: channel.id,
      name: channel.name,
      object: channel
    };
  }

  // Check for role mention
  if (message.mentions.roles.first()) {
    const role = message.mentions.roles.first();
    return {
      found: true,
      type: 'role',
      id: role.id,
      name: role.name,
      object: role
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
    logger.webhook.error(error, message);

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
    logger.webhook.error(error, message);

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
