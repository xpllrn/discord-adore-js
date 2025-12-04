const { PermissionFlagsBits, ChannelType, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, isGlobalDev } = require('../../../utils/permissions');
const { getService } = require('@services');
const config = require('../../../config/setup');
const { colors, emojis } = config;
const logger = require('../../../utils/logger');
const { runHelpCommand } = require('../../../utils/commandProcessor');

// Command execution tracker to prevent multiple executions
const executionTracker = new Map();

// Create voice manager panel with buttons
async function createVoiceManagerPanel(client, channel) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# Voice Master Panel\n-# Use the buttons below to control your voice channel.")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`\n${emojis.vmLock}— [\`Lock\`](https://adore.rest/) the voice channel\n${emojis.vmUnlock}— [\`Unlock\`](https://adore.rest/) the voice channel\n${emojis.vmHide}— [\`Hide\`](https://adore.rest/) the voice channel\n${emojis.vmUnhide}— [\`Unhide\`](https://adore.rest/) the voice channel\n${emojis.vmKick}— [\`Kick\`](https://adore.rest/) a user from channel\n\n${emojis.vmClaim}— [\`Claim\`](https://adore.rest/) an abandoned channel\n${emojis.vmTransfer}— [\`Transfer\`](https://adore.rest/) ownership\n${emojis.vmIncrease}— [\`Increase\`](https://adore.rest/) the user limit\n${emojis.vmDecrease}— [\`Decrease\`](https://adore.rest/) the user limit\n${emojis.vmRename}— [\`Rename\`](https://adore.rest/) the voice channel`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmLock).setCustomId("6800f9e6e8394c5cfd7b8c7f684b6cd2"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmUnlock).setCustomId("bc719b5197e94fb68e1db816f8fb00e6"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmHide).setCustomId("8a7385beb791449f9a7893ed5536e7e3"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmUnhide).setCustomId("4da0c243b63143d4a574d30c806e962b"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmKick).setCustomId("0c34acff106f453d84e4ba7122f868a5")
        )
    )
    .addActionRowComponents(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmClaim).setCustomId("2c8e65c78329459ee077b3c0e853e4a2"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmTransfer).setCustomId("f33fa78ce7964964cd5c155b5a15ebb7"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmIncrease).setCustomId("d0f359515fe244b0ad8824fb3c066d4b"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmDecrease).setCustomId("7f5598b8836e442ccd33a88afc00865c"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji(emojis.vmRename).setCustomId("48e538acf6e741aadc391f9d36977473")
        )
    );

  await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

module.exports = {
  name: "voicemaster",
  aliases: ['vm', 'voice', 'vc'],
  description: 'Voice channel management system',
  syntax: 'voicemaster [subcommand] (parameters)',
  example: 'voicemaster setup',
  isGroupCommand: true,

  subcommands: {
    setup: {
      name: 'setup',
      aliases: [],
      description: 'Setup the VoiceMaster system',
      syntax: '{guildprefix}voicemaster setup',
      parameters: [],
      example: '{guildprefix}voicemaster setup',
      handler: async (client, message, args, guildService) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return embeds.deny(message, 'I need **Manage Channels** permission to manage voicemaster');
        }

        const voiceManager = await guildService.getVoiceManager(message.guild.id);
        if (voiceManager.enabled) {
          return embeds.warn(message, 'voicemaster is already **setup in this server**. Use `,vm reset` to recreate.');
        }

        try {
          const category = await message.guild.channels.create({
            name: 'voice channel', type: ChannelType.GuildCategory,
            permissionOverwrites: [{ id: message.guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }]
          });

          const joinChannel = await message.guild.channels.create({
            name: 'create', type: ChannelType.GuildVoice, parent: category.id,
            permissionOverwrites: [{ id: message.guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }]
          });

          const menuChannel = await message.guild.channels.create({
            name: 'panel', type: ChannelType.GuildText, parent: category.id,
            permissionOverwrites: [{ id: message.guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }]
          });

          await guildService.setupVoiceManager(message.guild.id, category.id, joinChannel.id, menuChannel.id);
          await createVoiceManagerPanel(client, menuChannel);
          return embeds.success(message, '**Voicemaster interface** has been **setup**.');
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, '**Failed** to setup **voice manager**.');
        }
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset the VoiceMaster system',
      syntax: '{guildprefix}voicemaster reset',
      parameters: [],
      example: '{guildprefix}voicemaster reset',
      handler: async (client, message, args, guildService) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return embeds.deny(message, 'I need **Manage Channels** permission to manage voicemaster');
        }

        const voiceManager = await guildService.getVoiceManager(message.guild.id);
        if (!voiceManager.enabled) {
          return embeds.warn(message, 'Voice manager **is not setup** in this server. Use `,vm setup` first.');
        }

        try {
          for (const tempChannel of voiceManager.tempChannels || []) {
            try {
              const channel = message.guild.channels.cache.get(tempChannel.channelId);
              if (channel) await channel.delete('Voice manager reset');
            } catch (error) { /* Continue */ }
          }

          const channels = [voiceManager.joinChannelId, voiceManager.mutedChannelId, voiceManager.categoryId];
          for (const channelId of channels) {
            try {
              const channel = message.guild.channels.cache.get(channelId);
              if (channel) await channel.delete('Voice manager reset');
            } catch (error) { /* Continue */ }
          }

          await guildService.disableVoiceManager(message.guild.id);
          return embeds.success(message, '**Voicemaster interface** has been **reset**.');
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to **reset** voicemaster. Please **check my permissions**.');
        }
      }
    },

    lock: {
      name: 'lock',
      aliases: [],
      description: 'Lock your voice channel',
      syntax: '{guildprefix}voicemaster lock',
      parameters: [],
      example: '{guildprefix}voicemaster lock',
      handler: async (client, message, args, guildService, tempChannel) => {
        if (tempChannel.settings.locked) return embeds.warn(message, 'Your voice channel is already **locked**');
        await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, { Connect: false });
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { locked: true });
        return embeds.success(message, 'Your voice channel is **locked** now');
      }
    },

    unlock: {
      name: 'unlock',
      aliases: [],
      description: 'Unlock your voice channel',
      syntax: '{guildprefix}voicemaster unlock',
      parameters: [],
      example: '{guildprefix}voicemaster unlock',
      handler: async (client, message, args, guildService, tempChannel) => {
        if (!tempChannel.settings.locked) return embeds.warn(message, 'Your voice channel is not **locked**');
        await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, { Connect: true });
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { locked: false });
        return embeds.success(message, 'Your voice channel is **unlocked** now');
      }
    },

    hide: {
      name: 'hide',
      aliases: ['ghost'],
      description: 'Hide your voice channel',
      syntax: '{guildprefix}voicemaster hide',
      parameters: [],
      example: '{guildprefix}voicemaster ghost',
      handler: async (client, message, args, guildService, tempChannel) => {
        if (tempChannel.settings.hidden) return embeds.warn(message, 'Your voice channel is already **hidden**');
        await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, { ViewChannel: false });
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { hidden: true });
        return embeds.success(message, 'Your voice channel is **hidden** now');
      }
    },

    unhide: {
      name: 'unhide',
      aliases: ['unghost'],
      description: 'Unhide your voice channel',
      syntax: '{guildprefix}voicemaster unhide',
      parameters: [],
      example: '{guildprefix}voicemaster unghost',
      handler: async (client, message, args, guildService, tempChannel) => {
        if (!tempChannel.settings.hidden) return embeds.warn(message, 'Your voice channel is not **hidden**');
        await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, { ViewChannel: true });
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { hidden: false });
        return embeds.success(message, 'Your voice channel is **visible** now');
      }
    },

    increase: {
      name: 'increase',
      aliases: [],
      description: 'Increase user limit by 1',
      syntax: '{guildprefix}voicemaster increase',
      parameters: [],
      example: '{guildprefix}voicemaster increase',
      handler: async (client, message, args, guildService, tempChannel) => {
        const currentLimit = tempChannel.settings.userLimit || 0;
        const newLimit = currentLimit === 0 ? 2 : Math.min(currentLimit + 1, 99);
        await message.member.voice.channel.setUserLimit(newLimit);
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { userLimit: newLimit });
        return embeds.success(message, `Increased user limit to **${newLimit}**`);
      }
    },

    decrease: {
      name: 'decrease',
      aliases: [],
      description: 'Decrease user limit by 1',
      syntax: '{guildprefix}voicemaster decrease',
      parameters: [],
      example: '{guildprefix}voicemaster decrease',
      handler: async (client, message, args, guildService, tempChannel) => {
        const currentLimit = tempChannel.settings.userLimit || 0;
        if (currentLimit <= 1) return embeds.warn(message, 'User limit is already at minimum (1) or unlimited (0)');
        const newLimit = currentLimit - 1;
        await message.member.voice.channel.setUserLimit(newLimit);
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { userLimit: newLimit });
        return embeds.success(message, `Decreased user limit to **${newLimit}**`);
      }
    },

    limit: {
      name: 'limit',
      aliases: [],
      description: 'Set user limit (0-99)',
      syntax: '{guildprefix}voicemaster limit [number]',
      parameters: ['number'],
      example: '{guildprefix}voicemaster limit 5',
      handler: async (client, message, args, guildService, tempChannel) => {
        const limit = parseInt(args[0]);
        if (isNaN(limit) || limit < 0 || limit > 99) {
          return embeds.warn(message, 'Please provide a valid limit between 0-99: `,vm limit 5`\nUse 0 for no limit.');
        }
        await message.member.voice.channel.setUserLimit(limit);
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { userLimit: limit });
        const limitText = limit === 0 ? 'User limit **removed**' : `User limit set to **${limit}**`;
        return embeds.success(message, limitText);
      }
    },

    rename: {
      name: 'rename',
      aliases: ['name'],
      description: 'Change your channel name',
      syntax: '{guildprefix}voicemaster rename [name]',
      parameters: ['name'],
      example: '{guildprefix}voicemaster rename My Cool Channel',
      handler: async (client, message, args, guildService, tempChannel) => {
        const newName = args.join(' ');
        if (!newName) return embeds.warn(message, 'Please provide a new name: `,vm rename My Cool Channel`');
        if (newName.length > 100) return embeds.warn(message, 'Channel name must be 100 characters or less');
        await message.member.voice.channel.setName(newName);
        await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, { customName: newName });
        return embeds.success(message, `Voice channel **renamed** to: **${newName}**`);
      }
    },

    kick: {
      name: 'kick',
      aliases: ['disconnect'],
      description: 'Disconnect a user from your channel',
      syntax: '{guildprefix}voicemaster kick [@user]',
      parameters: ['user'],
      example: '{guildprefix}voicemaster kick @vwsn',
      handler: async (client, message, args, guildService, tempChannel) => {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return embeds.warn(message, 'Please mention a user to kick: `,vm kick @user`');
        if (targetUser.id === message.author.id) return embeds.warn(message, 'You cannot kick yourself');
        const targetMember = message.guild.members.cache.get(targetUser.id);
        if (!targetMember) return embeds.warn(message, 'User not found in this server');
        if (!targetMember.voice.channel || targetMember.voice.channel.id !== tempChannel.channelId) {
          return embeds.warn(message, 'User is not in your voice channel');
        }
        await targetMember.voice.disconnect('Kicked by channel owner');
        return embeds.success(message, `**${targetUser.username}** has been **kicked** from your voice channel`);
      }
    },

    invite: {
      name: 'invite',
      aliases: [],
      description: 'Invite a user to your channel',
      syntax: '{guildprefix}voicemaster invite [@user]',
      parameters: ['user'],
      example: '{guildprefix}voicemaster invite @vwsn',
      handler: async (client, message, args, guildService, tempChannel) => {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return embeds.warn(message, 'Please mention a user to invite: `,vm invite @user`');
        if (targetUser.id === message.author.id) return embeds.warn(message, 'You cannot invite yourself');
        if (targetUser.bot) return embeds.warn(message, 'You cannot invite bots');
        await message.member.voice.channel.permissionOverwrites.edit(targetUser.id, { Connect: true, ViewChannel: true });
        return embeds.success(message, `**${targetUser.username}** has been **granted** access to your voice channel`);
      }
    },

    reject: {
      name: 'reject',
      aliases: [],
      description: 'Reject a user from your channel',
      syntax: '{guildprefix}voicemaster reject [@user]',
      parameters: ['user'],
      example: '{guildprefix}voicemaster reject @vwsn',
      handler: async (client, message, args, guildService, tempChannel) => {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return embeds.warn(message, 'Please mention a user to reject: `,vm reject @user`');
        if (targetUser.id === message.author.id) return embeds.warn(message, 'You cannot reject yourself');
        const targetMember = message.guild.members.cache.get(targetUser.id);
        if (!targetMember) return embeds.warn(message, 'User not found in this server');
        if (targetMember.voice.channel && targetMember.voice.channel.id === tempChannel.channelId) {
          await targetMember.voice.disconnect('Rejected by channel owner');
        }
        await message.member.voice.channel.permissionOverwrites.edit(targetUser.id, { Connect: false, ViewChannel: false });
        return embeds.success(message, `**${targetUser.username}** has been **rejected** from your voice channel`);
      }
    },

    permit: {
      name: 'permit',
      aliases: ['allow'],
      description: 'Permit a user to access your channel',
      syntax: '{guildprefix}voicemaster permit [@user]',
      parameters: ['user'],
      example: '{guildprefix}voicemaster permit @vwsn',
      handler: async (client, message, args, guildService, tempChannel) => {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return embeds.warn(message, 'Please mention a user to permit: `,vm permit @user`');
        if (targetUser.id === message.author.id) return embeds.warn(message, 'You cannot permit yourself');
        await message.member.voice.channel.permissionOverwrites.edit(targetUser.id, { Connect: true, ViewChannel: true });
        return embeds.success(message, `**${targetUser.username}** has been **permitted** to access your voice channel`);
      }
    },

    status: {
      name: 'status',
      aliases: [],
      description: 'Set your channel status',
      syntax: '{guildprefix}voicemaster status [text]',
      parameters: ['text'],
      example: '{guildprefix}voicemaster status Playing games!',
      handler: async (client, message, args, guildService, tempChannel) => {
        const newStatus = args.join(' ');
        if (!newStatus) return embeds.warn(message, 'Please provide a status: `,vm status Playing games!`');
        if (newStatus.length > 500) return embeds.warn(message, 'Channel status must be 500 characters or less');
        try {
          await message.client.rest.put(`/channels/${message.member.voice.channel.id}/voice-status`, { body: { status: newStatus } });
          return embeds.success(message, `Voice channel **status** set to: **${newStatus}**`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to change channel status. Please check my permissions.');
        }
      }
    },

    transfer: {
      name: 'transfer',
      aliases: [],
      description: 'Transfer ownership to another user',
      syntax: '{guildprefix}voicemaster transfer [@user]',
      parameters: ['user'],
      example: '{guildprefix}voicemaster transfer @vwsn',
      handler: async (client, message, args, guildService, tempChannel) => {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return embeds.warn(message, 'Please mention a user to transfer ownership to: `,vm transfer @user`');
        if (targetUser.id === message.author.id) return embeds.warn(message, 'You cannot transfer ownership to yourself');
        if (targetUser.bot) return embeds.warn(message, 'You cannot transfer ownership to bots');
        const targetMember = message.guild.members.cache.get(targetUser.id);
        if (!targetMember) return embeds.warn(message, 'User not found in this server');
        if (!targetMember.voice.channel || targetMember.voice.channel.id !== tempChannel.channelId) {
          return embeds.warn(message, 'User must be **in your voice channel** to transfer ownership');
        }
        try {
          await guildService.transferVoiceChannelOwnership(message.guild.id, tempChannel.channelId, targetUser.id);
          return embeds.success(message, `Voice channel **ownership** transferred to **${targetUser.username}**`);
        } catch (error) {
          return embeds.deny(message, 'Failed to transfer ownership');
        }
      }
    },

    claim: {
      name: 'claim',
      aliases: [],
      description: 'Claim ownership of an abandoned channel',
      syntax: '{guildprefix}voicemaster claim',
      parameters: [],
      example: '{guildprefix}voicemaster claim',
      handler: async (client, message, args, guildService, tempChannel) => {
        const currentOwner = message.guild.members.cache.get(tempChannel.ownerId);
        if (currentOwner && currentOwner.voice.channel && currentOwner.voice.channel.id === tempChannel.channelId) {
          return embeds.warn(message, 'Cannot **claim** this channel while the owner is **still present**');
        }
        try {
          await guildService.transferVoiceChannelOwnership(message.guild.id, tempChannel.channelId, message.author.id);
          return embeds.success(message, 'You have **claimed ownership** of this voice channel');
        } catch (error) {
          return embeds.deny(message, 'Failed to claim ownership');
        }
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    // Prevent multiple executions
    const lastExecution = executionTracker.get(message.author.id);
    if (lastExecution && Date.now() - lastExecution < 2000) return;
    executionTracker.set(message.author.id, Date.now());
    setTimeout(() => executionTracker.delete(message.author.id), 5000);

    if (!args[0]) {
      return runHelpCommand(message, 'voicemaster');
    }

    const sub = args[0].toLowerCase();

    // Setup and Reset commands - require Manage Channels permission
    if (sub === 'setup' || sub === 'reset') {
      const subcommand = module.exports.subcommands[sub];
      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), guildService);
      }
    }

    // All other commands require the user to be in a voice channel
    const member = message.member;
    if (!member.voice.channel) {
      return embeds.warn(message, 'You must be in a **voice channel** to use this command');
    }

    const voiceManager = await guildService.getVoiceManager(message.guild.id);
    if (!voiceManager.enabled) {
      return embeds.warn(message, '**voicemaster** is **not setup** in this server. Use `,vm setup` first.');
    }

    const tempChannel = await guildService.getTempVoiceChannel(message.guild.id, member.voice.channel.id);
    if (!tempChannel) {
      return embeds.warn(message, 'You can only use this command **in a voicemaster** channels');
    }

    // Check if user is the owner of the channel (except for claim command)
    if (sub !== 'claim' && tempChannel.ownerId !== member.id && !isGlobalDev(member.id)) {
      return embeds.warn(message, 'Only the channel owner can use this command');
    }

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand && subcommand.name !== 'setup' && subcommand.name !== 'reset') {
      try {
        return await subcommand.handler(client, message, args.slice(1), guildService, tempChannel);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to execute command. Please check my permissions.');
      }
    }

    return runHelpCommand(message, 'voicemaster');
  }
};
