const { PermissionFlagsBits, EmbedBuilder, AutoModerationRuleTriggerType, AutoModerationActionType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findRole, findUser } = require('../../../handlers/finder');
const { colors } = require('../../../config/setup');
const logger = require('../../../utils/logger');

// ===== HELPER FUNCTIONS =====

// Helper function to find either a role, user, or channel
async function findRoleUserOrChannel(message, input) {
  const mentionedChannel = message.mentions.channels.first();
  if (mentionedChannel && mentionedChannel.guild.id === message.guild.id) {
    return { found: true, type: 'channel', id: mentionedChannel.id, name: mentionedChannel.name, object: mentionedChannel };
  }

  const mentionedRole = message.mentions.roles.first();
  if (mentionedRole && mentionedRole.guild.id === message.guild.id) {
    return { found: true, type: 'role', id: mentionedRole.id, name: mentionedRole.name, object: mentionedRole };
  }

  if (message.mentions.users.first()) {
    const user = message.mentions.users.first();
    const member = message.guild.members.cache.get(user.id);
    return { found: true, type: 'user', id: user.id, name: member ? member.displayName : user.username, object: member || user };
  }

  const channelResult = message.guild.channels.cache.find(ch => ch.name.toLowerCase().includes(input.toLowerCase()) || ch.id === input);
  if (channelResult) {
    return { found: true, type: 'channel', id: channelResult.id, name: channelResult.name, object: channelResult };
  }

  const roleResult = findRole(message.guild, input);
  if (roleResult.found) {
    return { found: true, type: 'role', id: roleResult.role.id, name: roleResult.role.name, object: roleResult.role };
  }

  const userResult = await findUser(message.guild, input, message.client);
  if (userResult.found) {
    return { found: true, type: 'user', id: userResult.user.id, name: userResult.user.displayName || userResult.user.username, object: userResult.user };
  }

  return { found: false, error: `I was unable to find a role, user, or channel with the name: ${input}` };
}

// Helper function to get existing AutoMod rule
async function getAutoModRule(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.find(rule => rule.name === 'adore AutoMod') || null;
  } catch (error) { return null; }
}

// Helper function to get existing invite AutoMod rule
async function getInviteAutoModRule(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.find(rule => rule.name === 'adore Invites') || null;
  } catch (error) { return null; }
}

// Helper function to get existing links AutoMod rule
async function getLinksAutoModRule(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.find(rule => rule.name === 'adore Links') || null;
  } catch (error) { return null; }
}

// Helper function to get or create AutoMod rule
async function getOrCreateAutoModRule(guild) {
  try {
    let rule = await getAutoModRule(guild);
    if (!rule) {
      rule = await guild.autoModerationRules.create({
        name: 'adore AutoMod',
        eventType: 1,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: { keywordFilter: [] },
        actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'The message is blocked by adore automod' } }],
        enabled: true,
        exemptRoles: [],
        exemptUsers: [],
        exemptChannels: []
      });
    }
    return rule;
  } catch (error) {
    logger.webhook.error(error);
    return null;
  }
}

// Helper function to create invite AutoMod rule
async function createInviteAutoModRule(guild) {
  try {
    await guild.autoModerationRules.create({
      name: 'adore Invites',
      eventType: 1,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: { regexPatterns: ['(?:https?:\\/\\/)?(?:www\\.|ptb\\.|canary\\.)?discord(?:app)?\\.(?:(?:com|gg)[\\/\\\\]+(?:invite|servers)[\\/\\\\]+[a-z0-9\\-_]+)|discord\\.gg[\\/\\\\]+[a-z0-9\\-_]+'] },
      actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'The message is blocked by adore automod' } }],
      enabled: true, exemptRoles: [], exemptUsers: [], exemptChannels: []
    });
    return { success: true };
  } catch (error) {
    logger.webhook.error(error);
    if (error.code === 50035 && error.rawError?.errors?._errors?.some(e => e.code === 'AUTO_MODERATION_MAX_RULES_OF_TYPE_EXCEEDED')) {
      return { success: false, message: 'Cannot create invite filter - Discord\'s AutoMod rule limit (6 rules) has been reached.' };
    }
    return { success: false, message: 'Failed to create invite filter rule.' };
  }
}

// Helper function to create links AutoMod rule
async function createLinksAutoModRule(guild) {
  try {
    await guild.autoModerationRules.create({
      name: 'adore Links',
      eventType: 1,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: { regexPatterns: ['(?:https?://?)?(\\S*@)?[\\\\a-z0-9_\\-\\.\\%]*[a-z0-9_\\-%]+(\\.|\%2e)[a-z(\%[a-z0-9])]{2,}'] },
      actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'The message is blocked by adore automod' } }],
      enabled: true, exemptRoles: [], exemptUsers: [], exemptChannels: []
    });
    return { success: true };
  } catch (error) {
    logger.webhook.error(error);
    if (error.code === 50035 && error.rawError?.errors?._errors?.some(e => e.code === 'AUTO_MODERATION_MAX_RULES_OF_TYPE_EXCEEDED')) {
      return { success: false, message: 'Cannot create links filter - Discord\'s AutoMod rule limit (6 rules) has been reached.' };
    }
    return { success: false, message: 'Failed to create links filter rule.' };
  }
}

// ===== WORD FILTER HANDLERS =====

async function handleWordsAdd(message, args) {
  if (!args[0]) return embeds.warn(message, 'Please provide a word to add to the filter');
  const keyword = args.join(' ').toLowerCase();
  if (keyword.length > 60) return embeds.warn(message, 'Keywords cannot be longer than 60 characters');

  const rule = await getOrCreateAutoModRule(message.guild);
  if (!rule) return embeds.deny(message, 'Failed to create or access AutoMod rule');

  const currentKeywords = rule.triggerMetadata.keywordFilter || [];
  if (currentKeywords.includes(keyword)) return embeds.warn(message, `The word **${keyword}** is already in the filter`);

  try {
    await rule.edit({ triggerMetadata: { keywordFilter: [...currentKeywords, keyword] } });
    return embeds.success(message, `Added **${keyword}** to the word filter`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update AutoMod rule');
  }
}

async function handleWordsRemove(message, args) {
  if (!args[0]) return embeds.warn(message, 'Please provide a word to remove from the filter');
  const keyword = args.join(' ').toLowerCase();

  const rule = await getAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No word filter found');

  const currentKeywords = rule.triggerMetadata.keywordFilter || [];
  if (!currentKeywords.includes(keyword)) return embeds.warn(message, `The word **${keyword}** is not in the filter`);

  const newKeywords = currentKeywords.filter(word => word !== keyword);
  try {
    if (newKeywords.length === 0) {
      await rule.delete('No keywords remaining');
      return embeds.success(message, `Removed **${keyword}** from the word filter. Filter disabled as no keywords remain.`);
    }
    await rule.edit({ triggerMetadata: { keywordFilter: newKeywords } });
    return embeds.success(message, `Removed **${keyword}** from the word filter`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update AutoMod rule');
  }
}

async function handleWordsList(message) {
  const rule = await getAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No word filter found');

  const keywords = rule.triggerMetadata.keywordFilter || [];
  if (keywords.length === 0) return embeds.warn(message, 'No words in filter');

  const keywordList = keywords.map((word, index) => `\`${(index + 1).toString().padStart(2, '0')}\` **${word}**`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Word Filter')
    .setDescription(keywordList)
    .setFooter({ text: `${keywords.length} filtered word${keywords.length === 1 ? '' : 's'}` });

  return message.channel.send({ embeds: [embed] });
}

async function handleWordsReset(message) {
  const rule = await getAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No word filter found');

  const keywords = rule.triggerMetadata.keywordFilter || [];
  if (keywords.length === 0) return embeds.warn(message, 'No words in filter to reset');

  try {
    await rule.delete('Word filter reset by user');
    return embeds.success(message, `Reset word filter - removed **${keywords.length}** word${keywords.length === 1 ? '' : 's'}`);
  } catch (error) {
    return embeds.deny(message, 'Failed to reset word filter');
  }
}

async function handleWordsExemptList(message) {
  const rule = await getAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No word filter found');

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No exempted roles, users, or channels found for word filter');
  }

  let description = '';
  let totalCount = 0;

  if (exemptRoles.length > 0) {
    description += '**Roles:**\n' + exemptRoles.map((roleId, i) => {
      const role = message.guild.roles.cache.get(roleId);
      return role ? `\`${(i + 1).toString().padStart(2, '0')}\` **${role.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Role\``;
    }).join('\n');
    totalCount += exemptRoles.length;
  }

  if (exemptUsers.length > 0) {
    if (description) description += '\n\n';
    description += '**Users:**\n' + exemptUsers.map((userId, i) => {
      const member = message.guild.members.cache.get(userId);
      return member ? `\`${(i + 1).toString().padStart(2, '0')}\` **${member.displayName}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Unknown User\``;
    }).join('\n');
    totalCount += exemptUsers.length;
  }

  if (exemptChannels.length > 0) {
    if (description) description += '\n\n';
    description += '**Channels:**\n' + exemptChannels.map((channelId, i) => {
      const channel = message.guild.channels.cache.get(channelId);
      return channel ? `\`${(i + 1).toString().padStart(2, '0')}\` **${channel.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Channel\``;
    }).join('\n');
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
  if (!args[0]) return embeds.warn(message, 'Please provide a role, user, or channel to toggle exempt for');

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);
  if (!target.found) return embeds.warn(message, target.error);

  const rule = await getAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No word filter found. Enable word filtering first.');

  const currentExemptRoles = Array.isArray(rule.exemptRoles) ? rule.exemptRoles : [];
  const currentExemptUsers = Array.isArray(rule.exemptUsers) ? rule.exemptUsers : [];
  const currentExemptChannels = Array.isArray(rule.exemptChannels) ? rule.exemptChannels : [];

  let newExemptRoles = currentExemptRoles, newExemptUsers = currentExemptUsers, newExemptChannels = currentExemptChannels;
  let action;

  if (target.type === 'role') {
    const isExempt = currentExemptRoles.includes(target.id);
    newExemptRoles = isExempt ? currentExemptRoles.filter(id => id !== target.id) : [...currentExemptRoles, target.id];
    action = isExempt ? 'removed from' : 'added to';
  } else if (target.type === 'user') {
    const isExempt = currentExemptUsers.includes(target.id);
    newExemptUsers = isExempt ? currentExemptUsers.filter(id => id !== target.id) : [...currentExemptUsers, target.id];
    action = isExempt ? 'removed from' : 'added to';
  } else if (target.type === 'channel') {
    const isExempt = currentExemptChannels.includes(target.id);
    newExemptChannels = isExempt ? currentExemptChannels.filter(id => id !== target.id) : [...currentExemptChannels, target.id];
    action = isExempt ? 'removed from' : 'added to';
  }

  try {
    await rule.edit({ exemptRoles: newExemptRoles, exemptUsers: newExemptUsers, exemptChannels: newExemptChannels });
    return embeds.success(message, `**${target.name}** has been ${action} the word filter exempt list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update word filter rule');
  }
}

// ===== INVITE FILTER HANDLERS =====

async function handleInvitesToggle(message, enable) {
  const rule = await getInviteAutoModRule(message.guild);

  if (enable) {
    if (rule) return embeds.warn(message, '**Invite filter** is already **enabled**');
    const result = await createInviteAutoModRule(message.guild);
    return result.success ? embeds.success(message, '**Invite filter** has been **enabled**') : embeds.deny(message, result.message);
  } else {
    if (!rule) return embeds.warn(message, '**Invite filter** is already **disabled**');
    try {
      await rule.delete('Invite filter disabled by user');
      return embeds.success(message, '**Invite filter** has been **disabled**');
    } catch (error) {
      return embeds.deny(message, 'Failed to disable **invite filter**');
    }
  }
}

async function handleInvitesExemptList(message) {
  const rule = await getInviteAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No **invite filter** found');

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No exempted roles, users, or channels found for **invite filter**');
  }

  let description = '';
  let totalCount = 0;

  if (exemptRoles.length > 0) {
    description += '**Roles:**\n' + exemptRoles.map((roleId, i) => {
      const role = message.guild.roles.cache.get(roleId);
      return role ? `\`${(i + 1).toString().padStart(2, '0')}\` **${role.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Role\``;
    }).join('\n');
    totalCount += exemptRoles.length;
  }

  if (exemptUsers.length > 0) {
    if (description) description += '\n\n';
    description += '**Users:**\n' + exemptUsers.map((userId, i) => {
      const member = message.guild.members.cache.get(userId);
      return member ? `\`${(i + 1).toString().padStart(2, '0')}\` **${member.displayName}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Unknown User\``;
    }).join('\n');
    totalCount += exemptUsers.length;
  }

  if (exemptChannels.length > 0) {
    if (description) description += '\n\n';
    description += '**Channels:**\n' + exemptChannels.map((channelId, i) => {
      const channel = message.guild.channels.cache.get(channelId);
      return channel ? `\`${(i + 1).toString().padStart(2, '0')}\` **${channel.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Channel\``;
    }).join('\n');
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
  if (!args[0]) return embeds.warn(message, 'Please provide a role, user, or channel to toggle exempt for');

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);
  if (!target.found) return embeds.warn(message, target.error);

  const rule = await getInviteAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No **invite filter** found. Enable **invite filtering** first.');

  const currentExemptRoles = Array.isArray(rule.exemptRoles) ? rule.exemptRoles : [];
  const currentExemptUsers = Array.isArray(rule.exemptUsers) ? rule.exemptUsers : [];
  const currentExemptChannels = Array.isArray(rule.exemptChannels) ? rule.exemptChannels : [];

  let newExemptRoles = currentExemptRoles, newExemptUsers = currentExemptUsers, newExemptChannels = currentExemptChannels;
  let action;

  if (target.type === 'role') {
    const isExempt = currentExemptRoles.includes(target.id);
    newExemptRoles = isExempt ? currentExemptRoles.filter(id => id !== target.id) : [...currentExemptRoles, target.id];
    action = isExempt ? 'removed from' : 'added to';
  } else if (target.type === 'user') {
    const isExempt = currentExemptUsers.includes(target.id);
    newExemptUsers = isExempt ? currentExemptUsers.filter(id => id !== target.id) : [...currentExemptUsers, target.id];
    action = isExempt ? 'removed from' : 'added to';
  } else if (target.type === 'channel') {
    const isExempt = currentExemptChannels.includes(target.id);
    newExemptChannels = isExempt ? currentExemptChannels.filter(id => id !== target.id) : [...currentExemptChannels, target.id];
    action = isExempt ? 'removed from' : 'added to';
  }

  try {
    await rule.edit({ exemptRoles: newExemptRoles, exemptUsers: newExemptUsers, exemptChannels: newExemptChannels });
    return embeds.success(message, `**${target.name}** has been ${action} the **invite filter** exempt list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update **invite filter** rule');
  }
}

// ===== LINKS FILTER HANDLERS =====

async function handleLinksToggle(message, enable) {
  const rule = await getLinksAutoModRule(message.guild);

  if (enable) {
    if (rule) return embeds.warn(message, '**Links filter** is already **enabled**');
    const result = await createLinksAutoModRule(message.guild);
    return result.success ? embeds.success(message, '**Links filter** has been **enabled**') : embeds.deny(message, result.message);
  } else {
    if (!rule) return embeds.warn(message, '**Links filter** is already **disabled**');
    try {
      await rule.delete('Links filter disabled by user');
      return embeds.success(message, '**Links filter** has been **disabled**');
    } catch (error) {
      return embeds.deny(message, 'Failed to disable **links filter**');
    }
  }
}

async function handleLinksExemptList(message) {
  const rule = await getLinksAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No **links filter** found');

  const exemptRoles = rule.exemptRoles || [];
  const exemptUsers = rule.exemptUsers || [];
  const exemptChannels = rule.exemptChannels || [];

  if (exemptRoles.length === 0 && exemptUsers.length === 0 && exemptChannels.length === 0) {
    return embeds.warn(message, 'No exempted roles, users, or channels found for **links filter**');
  }

  let description = '';
  let totalCount = 0;

  if (exemptRoles.length > 0) {
    description += '**Roles:**\n' + exemptRoles.map((roleId, i) => {
      const role = message.guild.roles.cache.get(roleId);
      return role ? `\`${(i + 1).toString().padStart(2, '0')}\` **${role.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Role\``;
    }).join('\n');
    totalCount += exemptRoles.length;
  }

  if (exemptUsers.length > 0) {
    if (description) description += '\n\n';
    description += '**Users:**\n' + exemptUsers.map((userId, i) => {
      const member = message.guild.members.cache.get(userId);
      return member ? `\`${(i + 1).toString().padStart(2, '0')}\` **${member.displayName}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Unknown User\``;
    }).join('\n');
    totalCount += exemptUsers.length;
  }

  if (exemptChannels.length > 0) {
    if (description) description += '\n\n';
    description += '**Channels:**\n' + exemptChannels.map((channelId, i) => {
      const channel = message.guild.channels.cache.get(channelId);
      return channel ? `\`${(i + 1).toString().padStart(2, '0')}\` **${channel.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Channel\``;
    }).join('\n');
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
  if (!args[0]) return embeds.warn(message, 'Please provide a role, user, or channel to toggle exempt for');

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);
  if (!target.found) return embeds.warn(message, target.error);

  const rule = await getLinksAutoModRule(message.guild);
  if (!rule) return embeds.warn(message, 'No **links filter** found. Enable **links filtering** first.');

  const currentExemptRoles = Array.isArray(rule.exemptRoles) ? rule.exemptRoles : [];
  const currentExemptUsers = Array.isArray(rule.exemptUsers) ? rule.exemptUsers : [];
  const currentExemptChannels = Array.isArray(rule.exemptChannels) ? rule.exemptChannels : [];

  let newExemptRoles = currentExemptRoles, newExemptUsers = currentExemptUsers, newExemptChannels = currentExemptChannels;
  let action;

  if (target.type === 'role') {
    const isExempt = currentExemptRoles.includes(target.id);
    newExemptRoles = isExempt ? currentExemptRoles.filter(id => id !== target.id) : [...currentExemptRoles, target.id];
    action = isExempt ? 'removed from' : 'added to';
  } else if (target.type === 'user') {
    const isExempt = currentExemptUsers.includes(target.id);
    newExemptUsers = isExempt ? currentExemptUsers.filter(id => id !== target.id) : [...currentExemptUsers, target.id];
    action = isExempt ? 'removed from' : 'added to';
  } else if (target.type === 'channel') {
    const isExempt = currentExemptChannels.includes(target.id);
    newExemptChannels = isExempt ? currentExemptChannels.filter(id => id !== target.id) : [...currentExemptChannels, target.id];
    action = isExempt ? 'removed from' : 'added to';
  }

  try {
    await rule.edit({ exemptRoles: newExemptRoles, exemptUsers: newExemptUsers, exemptChannels: newExemptChannels });
    return embeds.success(message, `**${target.name}** has been ${action} the **links filter** exempt list`);
  } catch (error) {
    return embeds.deny(message, 'Failed to update **links filter** rule');
  }
}

// ===== MASS MENTION FILTER HANDLERS =====

async function handleMassMentionToggle(message, enable, args = []) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const ms = require('ms');

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    
    if (!guildData.MassMentionFilter) {
      guildData.MassMentionFilter = { enabled: false, channels: [], exemptRoles: [], exemptChannels: [], threshold: 5, action: 'delete', duration: null };
    }

    if (enable) {
      let threshold = guildData.MassMentionFilter.threshold || 5;
      let action = guildData.MassMentionFilter.action || 'delete';
      let duration = guildData.MassMentionFilter.duration || null;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--threshold' && args[i + 1]) {
          const parsedThreshold = parseInt(args[i + 1]);
          if (parsedThreshold && parsedThreshold > 0 && parsedThreshold <= 50) { threshold = parsedThreshold; i++; }
          else return embeds.warn(message, 'Threshold must be between 1 and 50');
        } else if (args[i] === '--do' && args[i + 1]) {
          const actionArg = args[i + 1].toLowerCase();
          if (actionArg === 'delete') { action = 'delete'; i++; }
          else if (actionArg === 'mute' && args[i + 2]) {
            action = 'mute';
            const parsedDuration = ms(args[i + 2]);
            if (parsedDuration && parsedDuration > 0) { duration = args[i + 2]; i += 2; }
            else return embeds.warn(message, 'Invalid duration format. Example: `10m`, `1h`, `30s`');
          } else return embeds.warn(message, 'Invalid action. Use: `delete` or `mute [duration]`');
        }
      }

      guildData.MassMentionFilter.enabled = true;
      guildData.MassMentionFilter.threshold = threshold;
      guildData.MassMentionFilter.action = action;
      guildData.MassMentionFilter.duration = duration;
      await guildService.set(message.guild.id, guildData);
      
      let statusMsg = `Mass mention filter has been **enabled**\n**Threshold:** ${threshold} mentions\n**Action:** ${action}`;
      if (action === 'mute' && duration) statusMsg += ` for ${duration}`;
      return embeds.success(message, statusMsg);
    } else {
      if (!guildData.MassMentionFilter.enabled) return embeds.warn(message, '**Mass mention filter** is already **disabled**');
      guildData.MassMentionFilter.enabled = false;
      await guildService.set(message.guild.id, guildData);
      return embeds.success(message, '**Mass mention filter** has been **disabled**');
    }
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to update mass mention filter settings');
  }
}

async function handleMassMentionExemptList(message) {
  const { getService } = require('@services');
  const guildService = getService('guild');

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    const exemptRoles = guildData.MassMentionFilter?.exemptRoles || [];
    const exemptChannels = guildData.MassMentionFilter?.exemptChannels || [];

    if (exemptRoles.length === 0 && exemptChannels.length === 0) {
      return embeds.warn(message, 'No exempted roles or channels found for **mass mention filter**');
    }

    let description = '';
    let totalCount = 0;

    if (exemptRoles.length > 0) {
      description += '**Roles:**\n' + exemptRoles.map((roleId, i) => {
        const role = message.guild.roles.cache.get(roleId);
        return role ? `\`${(i + 1).toString().padStart(2, '0')}\` **${role.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Role\``;
      }).join('\n');
      totalCount += exemptRoles.length;
    }

    if (exemptChannels.length > 0) {
      if (description) description += '\n\n';
      description += '**Channels:**\n' + exemptChannels.map((channelId, i) => {
        const channel = message.guild.channels.cache.get(channelId);
        return channel ? `\`${(i + 1).toString().padStart(2, '0')}\` **${channel.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Channel\``;
      }).join('\n');
      totalCount += exemptChannels.length;
    }

    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle('Mass Mention Filter - Exempted List')
      .setDescription(description)
      .setFooter({ text: `${totalCount} total exempted entr${totalCount === 1 ? 'y' : 'ies'}` });

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to retrieve exempt list');
  }
}

async function handleMassMentionToggleExempt(message, args) {
  const { getService } = require('@services');
  const guildService = getService('guild');

  if (!args[0]) return embeds.warn(message, 'Please provide a role or channel to toggle exempt for');

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);
  if (!target.found) return embeds.warn(message, target.error);

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    if (!guildData.MassMentionFilter) {
      guildData.MassMentionFilter = { enabled: false, channels: [], exemptRoles: [], exemptChannels: [], threshold: 5, action: 'delete', duration: null };
    }

    let action;
    if (target.type === 'role') {
      const exemptRoles = guildData.MassMentionFilter.exemptRoles || [];
      const isExempt = exemptRoles.includes(target.id);
      guildData.MassMentionFilter.exemptRoles = isExempt ? exemptRoles.filter(id => id !== target.id) : [...exemptRoles, target.id];
      action = isExempt ? 'removed from' : 'added to';
    } else if (target.type === 'channel') {
      const exemptChannels = guildData.MassMentionFilter.exemptChannels || [];
      const isExempt = exemptChannels.includes(target.id);
      guildData.MassMentionFilter.exemptChannels = isExempt ? exemptChannels.filter(id => id !== target.id) : [...exemptChannels, target.id];
      action = isExempt ? 'removed from' : 'added to';
    } else {
      return embeds.warn(message, 'Please provide a role or channel (users not supported for mass mention filter)');
    }

    await guildService.set(message.guild.id, guildData);
    return embeds.success(message, `**${target.name}** has been ${action} the **mass mention filter** exempt list`);
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to update exempt list');
  }
}

// ===== SPAM FILTER HANDLERS =====

async function handleSpamToggle(message, target, enable, args) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const { findChannel } = require('../../../handlers/finder');
  const ms = require('ms');

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    if (!guildData.SpamFilter) {
      guildData.SpamFilter = { enabled: false, channels: [], exemptRoles: [], exemptChannels: [], threshold: 5, action: 'delete', duration: null };
    }

    let threshold = guildData.SpamFilter.threshold || 5;
    let action = guildData.SpamFilter.action || 'delete';
    let duration = guildData.SpamFilter.duration || null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--threshold' && args[i + 1]) {
        const parsedThreshold = parseInt(args[i + 1]);
        if (parsedThreshold && parsedThreshold > 0 && parsedThreshold <= 20) { threshold = parsedThreshold; i++; }
      } else if (args[i] === '--do' && args[i + 1]) {
        const actionArg = args[i + 1].toLowerCase();
        if (actionArg === 'delete' || actionArg === 'jail') { action = actionArg; i++; }
        else if (actionArg === 'mute' && args[i + 2]) {
          action = 'mute';
          const parsedDuration = ms(args[i + 2]);
          if (parsedDuration && parsedDuration > 0) { duration = args[i + 2]; i += 2; }
          else return embeds.warn(message, 'Invalid duration format. Example: `10m`, `1h`, `30s`');
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
        if (action === 'mute' && duration) statusMsg += ` for ${duration}`;
      }
      return embeds.success(message, statusMsg);
    } else if (target === 'channel') {
      if (!args[0]) return embeds.warn(message, 'Please specify a channel');
      const channelResult = findChannel(message.guild, args[0]);
      if (!channelResult.found) return embeds.warn(message, channelResult.error);

      const channel = channelResult.channel;
      const channels = guildData.SpamFilter.channels || [];

      if (enable) {
        if (channels.includes(channel.id)) return embeds.warn(message, `Spam filter is already enabled for ${channel}`);
        channels.push(channel.id);
        guildData.SpamFilter.channels = channels;
        guildData.SpamFilter.enabled = true;
        guildData.SpamFilter.threshold = threshold;
        guildData.SpamFilter.action = action;
        guildData.SpamFilter.duration = duration;
        await guildService.set(message.guild.id, guildData);
        
        let statusMsg = `Spam filter has been **enabled** for ${channel}\n**Threshold:** ${threshold} messages in 5 seconds\n**Action:** ${action}`;
        if (action === 'mute' && duration) statusMsg += ` for ${duration}`;
        return embeds.success(message, statusMsg);
      } else {
        if (!channels.includes(channel.id)) return embeds.warn(message, `Spam filter is not enabled for ${channel}`);
        guildData.SpamFilter.channels = channels.filter(id => id !== channel.id);
        await guildService.set(message.guild.id, guildData);
        return embeds.success(message, `Spam filter has been **disabled** for ${channel}`);
      }
    }
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to update spam filter settings');
  }
}

async function handleSpamExemptList(message) {
  const { getService } = require('@services');
  const guildService = getService('guild');

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    const exemptRoles = guildData.SpamFilter?.exemptRoles || [];
    const exemptChannels = guildData.SpamFilter?.exemptChannels || [];

    if (exemptRoles.length === 0 && exemptChannels.length === 0) {
      return embeds.warn(message, 'No exempted roles or channels found for **spam filter**');
    }

    let description = '';
    let totalCount = 0;

    if (exemptRoles.length > 0) {
      description += '**Roles:**\n' + exemptRoles.map((roleId, i) => {
        const role = message.guild.roles.cache.get(roleId);
        return role ? `\`${(i + 1).toString().padStart(2, '0')}\` **${role.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Role\``;
      }).join('\n');
      totalCount += exemptRoles.length;
    }

    if (exemptChannels.length > 0) {
      if (description) description += '\n\n';
      description += '**Channels:**\n' + exemptChannels.map((channelId, i) => {
        const channel = message.guild.channels.cache.get(channelId);
        return channel ? `\`${(i + 1).toString().padStart(2, '0')}\` **${channel.name}**` : `\`${(i + 1).toString().padStart(2, '0')}\` \`Deleted Channel\``;
      }).join('\n');
      totalCount += exemptChannels.length;
    }

    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle('Spam Filter - Exempted List')
      .setDescription(description)
      .setFooter({ text: `${totalCount} total exempted entr${totalCount === 1 ? 'y' : 'ies'}` });

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to retrieve exempt list');
  }
}

async function handleSpamToggleExempt(message, args) {
  const { getService } = require('@services');
  const guildService = getService('guild');

  if (!args[0]) return embeds.warn(message, 'Please provide a role or channel to toggle exempt for');

  const input = args.join(' ');
  const target = await findRoleUserOrChannel(message, input);
  if (!target.found) return embeds.warn(message, target.error);

  try {
    const guildData = await guildService.ensureGuildData(message.guild.id);
    if (!guildData.SpamFilter) {
      guildData.SpamFilter = { enabled: false, channels: [], exemptRoles: [], exemptChannels: [] };
    }

    let action;
    if (target.type === 'role') {
      const exemptRoles = guildData.SpamFilter.exemptRoles || [];
      const isExempt = exemptRoles.includes(target.id);
      guildData.SpamFilter.exemptRoles = isExempt ? exemptRoles.filter(id => id !== target.id) : [...exemptRoles, target.id];
      action = isExempt ? 'removed from' : 'added to';
    } else if (target.type === 'channel') {
      const exemptChannels = guildData.SpamFilter.exemptChannels || [];
      const isExempt = exemptChannels.includes(target.id);
      guildData.SpamFilter.exemptChannels = isExempt ? exemptChannels.filter(id => id !== target.id) : [...exemptChannels, target.id];
      action = isExempt ? 'removed from' : 'added to';
    } else {
      return embeds.warn(message, 'Please provide a role or channel (users not supported for spam filter)');
    }

    await guildService.set(message.guild.id, guildData);
    return embeds.success(message, `**${target.name}** has been ${action} the **spam filter** exempt list`);
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to update exempt list');
  }
}

// ===== MODULE EXPORTS WITH SUBCOMMANDS =====

module.exports = {
  name: "filter",
  aliases: ['automod'],
  description: "Manage Discord's built-in AutoMod filtering system",
  syntax: 'filter [subcommand] (parameters)',
  example: 'filter add badword',
  permission: "manage_guild",
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add a word to the filter',
      syntax: '{guildprefix}filter add [word]',
      parameters: ['word'],
      example: '{guildprefix}filter add badword',
      handler: async (client, message, args) => handleWordsAdd(message, args)
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove a word from the filter',
      syntax: '{guildprefix}filter remove [word]',
      parameters: ['word'],
      example: '{guildprefix}filter remove badword',
      handler: async (client, message, args) => handleWordsRemove(message, args)
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all filtered words',
      syntax: '{guildprefix}filter list',
      parameters: [],
      example: '{guildprefix}filter list',
      handler: async (client, message, args) => handleWordsList(message)
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset the word filter',
      syntax: '{guildprefix}filter reset',
      parameters: [],
      example: '{guildprefix}filter reset',
      handler: async (client, message, args) => handleWordsReset(message)
    },

    exempt: {
      name: 'exempt',
      aliases: [],
      description: 'Manage filter exempt list (toggle or list)',
      syntax: '{guildprefix}filter exempt [role/user/channel/list]',
      parameters: ['role/user/channel/list'],
      example: '{guildprefix}filter exempt @Moderator',
      handler: async (client, message, args) => {
        if (!args[0]) return runHelpCommand(message, 'filter');
        if (args[0].toLowerCase() === 'list') return handleWordsExemptList(message);
        return handleWordsToggleExempt(message, args);
      }
    },

    invites: {
      name: 'invites',
      aliases: ['invite'],
      description: 'Manage invite link filtering',
      syntax: '{guildprefix}filter invites [on/off/exempt]',
      parameters: ['on/off/exempt'],
      example: '{guildprefix}filter invites on',
      handler: async (client, message, args) => {
        const sub = args[0]?.toLowerCase();
        if (!sub) return runHelpCommand(message, 'filter');
        if (sub === 'on') return handleInvitesToggle(message, true);
        if (sub === 'off') return handleInvitesToggle(message, false);
        if (sub === 'exempt') {
          if (args[1]?.toLowerCase() === 'list') return handleInvitesExemptList(message);
          return handleInvitesToggleExempt(message, args.slice(1));
        }
        return runHelpCommand(message, 'filter');
      }
    },

    links: {
      name: 'links',
      aliases: ['link'],
      description: 'Manage link filtering',
      syntax: '{guildprefix}filter links [on/off/exempt]',
      parameters: ['on/off/exempt'],
      example: '{guildprefix}filter links on',
      handler: async (client, message, args) => {
        const sub = args[0]?.toLowerCase();
        if (!sub) return runHelpCommand(message, 'filter');
        if (sub === 'on') return handleLinksToggle(message, true);
        if (sub === 'off') return handleLinksToggle(message, false);
        if (sub === 'exempt') {
          if (args[1]?.toLowerCase() === 'list') return handleLinksExemptList(message);
          return handleLinksToggleExempt(message, args.slice(1));
        }
        return runHelpCommand(message, 'filter');
      }
    },

    massmention: {
      name: 'massmention',
      aliases: ['mentions'],
      description: 'Manage mass mention filtering with custom threshold',
      syntax: '{guildprefix}filter massmention [on/off/exempt] --threshold [num] --do [action]',
      parameters: ['on/off/exempt', '--threshold', '--do'],
      example: '{guildprefix}filter massmention on --threshold 10 --do mute 5m',
      handler: async (client, message, args) => {
        const sub = args[0]?.toLowerCase();
        if (!sub) return runHelpCommand(message, 'filter');
        if (sub === 'on') return handleMassMentionToggle(message, true, args.slice(1));
        if (sub === 'off') return handleMassMentionToggle(message, false, args.slice(1));
        if (sub === 'exempt') {
          if (args[1]?.toLowerCase() === 'list') return handleMassMentionExemptList(message);
          return handleMassMentionToggleExempt(message, args.slice(1));
        }
        return runHelpCommand(message, 'filter');
      }
    },

    spam: {
      name: 'spam',
      aliases: [],
      description: 'Manage spam filtering with custom actions',
      syntax: '{guildprefix}filter spam [on/off/channel/exempt] --threshold [num] --do [action]',
      parameters: ['on/off/channel/exempt', '--threshold', '--do'],
      example: '{guildprefix}filter spam on --threshold 5 --do mute 10m',
      handler: async (client, message, args) => {
        const sub = args[0]?.toLowerCase();
        if (!sub) return runHelpCommand(message, 'filter');
        if (sub === 'on') return handleSpamToggle(message, 'all', true, args.slice(1));
        if (sub === 'off') return handleSpamToggle(message, 'all', false, args.slice(1));
        if (sub === 'channel') {
          const toggle = args[1]?.toLowerCase();
          if (toggle === 'on' || toggle === 'off') return handleSpamToggle(message, 'channel', toggle === 'on', args.slice(2));
          return runHelpCommand(message, 'filter');
        }
        if (sub === 'exempt') {
          if (args[1]?.toLowerCase() === 'list') return handleSpamExemptList(message);
          return handleSpamToggleExempt(message, args.slice(1));
        }
        return runHelpCommand(message, 'filter');
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return embeds.deny(message, 'I need **Manage Guild** permission to manage AutoMod rules');
    }

    if (!args[0]) return runHelpCommand(message, 'filter');

    const sub = args[0].toLowerCase();

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      try {
        return await subcommand.handler(client, message, args.slice(1));
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'An error occurred while executing the command.');
      }
    }

    return runHelpCommand(message, 'filter');
  }
};
