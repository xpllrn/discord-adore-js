const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');

// SHARED LOGIC: Set confession channel
async function setConfessionChannelShared(context, channel, confessionService) {
  const guild = context.guild;

  await confessionService.setConfessionChannel(guild.id, channel.id);

  // Send the confession embed with button to the channel
  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle('Anonymous Confession System')
    .setDescription('Please use the confess button below to create a confession');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confession_submit')
        .setLabel('Submit a Confession')
        .setStyle(ButtonStyle.Secondary)
    );

  const sentMessage = await channel.send({ embeds: [embed], components: [row] });

  // Pin the message
  try {
    await sentMessage.pin();
  } catch (error) {
    console.error('Error pinning confession message:', error);
  }

  return embeds.success(context, `Set ${channel} as the **confession channel** and sent the confession button`, false);
}

// SHARED LOGIC: View confession channel
async function viewConfessionChannelShared(context, confessionService) {
  const guild = context.guild;
  const confessionConfig = await confessionService.getConfessionConfig(guild.id);

  if (!confessionConfig.channelId) {
    return embeds.info(context, 'No **confession channel** is currently set', false);
  }

  return embeds.info(context, `Current **confession channel**: <#${confessionConfig.channelId}>`, false);
}

// SHARED LOGIC: Toggle blacklist user
async function toggleBlacklistUserShared(context, user, confessionService) {
  const guild = context.guild;
  const isBlacklisted = await confessionService.isUserIgnored(guild.id, user.id);

  if (isBlacklisted) {
    await confessionService.removeIgnoredUser(guild.id, user.id);
    return embeds.success(context, `Removed ${user} from the **confession blacklist**`, false);
  } else {
    await confessionService.addIgnoredUser(guild.id, user.id);
    return embeds.success(context, `Added ${user} to the **confession blacklist**`, false);
  }
}

// SHARED LOGIC: View blacklisted users
async function viewBlacklistedUsersShared(context, confessionService) {
  const guild = context.guild;
  const confessionConfig = await confessionService.getConfessionConfig(guild.id);

  if (confessionConfig.ignoredUsers.length === 0) {
    return embeds.info(context, 'No **confession blacklist** users are currently set', false);
  }

  const userList = confessionConfig.ignoredUsers.map(id => `<@${id}>`).join(', ');
  return embeds.info(context, `**confession blacklist** users: ${userList}`, false);
}

// SHARED LOGIC: View confession config
async function viewConfessionConfigShared(context, confessionService) {
  const guild = context.guild;
  const user = context.user || context.author;
  const isInteraction = !!context.user;

  const confessionConfig = await confessionService.getConfessionConfig(guild.id);

  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setAuthor({
      name: user.username,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setTitle('Confession System Configuration')
    .addFields(
      {
        name: 'Status',
        value: confessionConfig.enabled ? `${config.emojis.success} Enabled` : `${config.emojis.error} Disabled`,
        inline: true
      },
      {
        name: 'Channel',
        value: confessionConfig.channelId ? `<#${confessionConfig.channelId}>` : 'Not set',
        inline: true
      },
      {
        name: 'Blacklisted Users',
        value: confessionConfig.ignoredUsers.length > 0 ? confessionConfig.ignoredUsers.map(id => `<@${id}>`).join(', ') : 'None',
        inline: false
      },
      {
        name: 'Next Confession ID',
        value: `#${confessionConfig.nextConfessionId}`,
        inline: true
      }
    )
    .setFooter({ text: `Guild ID: ${guild.id}` });

  if (isInteraction) {
    return context.reply({ embeds: [embed], ephemeral: false });
  } else {
    return context.channel.send({ embeds: [embed] });
  }
}

// SHARED LOGIC: Submit a confession
async function submitConfession(context, confessionText) {
  const confessionService = getService('confession');
  const guild = context.guild;
  const user = context.user || context.author;
  const isInteraction = !!context.user;

  // Get confession config
  const confessionConfig = await confessionService.getConfessionConfig(guild.id);

  // Check if system is enabled
  if (!confessionConfig.enabled || !confessionConfig.channelId) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: The confession system is **not enabled** on this server.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: false });
    } else {
      return embeds.deny(context, 'The confession system is **not enabled** on this server.', false);
    }
  }

  // Check if user is blacklisted
  const isBlacklisted = await confessionService.isUserIgnored(guild.id, user.id);
  if (isBlacklisted) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: You are **blacklisted** from submitting confessions in this server.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: false });
    } else {
      return embeds.deny(context, 'You are **blacklisted** from submitting confessions in this server.', false);
    }
  }

  // Get confession channel
  const confessionChannel = guild.channels.cache.get(confessionConfig.channelId);
  if (!confessionChannel) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: The confession channel **no longer exists**.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: false });
    } else {
      return embeds.deny(context, 'The confession channel **no longer exists**.', false);
    }
  }

  // Get next confession ID
  const confessionId = await confessionService.getNextConfessionId(guild.id);

  // Get user's top role color
  const member = await guild.members.fetch(user.id);
  const roleColor = member.displayHexColor !== '#000000' ? member.displayHexColor : config.colors.embed;

  // Create confession embed
  const confessionEmbed = new EmbedBuilder()
    .setColor(roleColor)
    .setTitle(`Anonymous Confession (#${confessionId})`)
    .setDescription(confessionText);

  // Create buttons
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confession_submit')
        .setLabel('Submit a Confession')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('confession_reply')
        .setLabel('Reply')
        .setStyle(ButtonStyle.Secondary)
    );

  // Remove buttons from previous confession if exists
  if (confessionConfig.lastMessageId) {
    try {
      const lastMessage = await confessionChannel.messages.fetch(confessionConfig.lastMessageId);
      if (lastMessage) {
        await lastMessage.edit({ components: [] });
      }
    } catch (error) {
      // Message might be deleted, ignore
    }
  }

  // Send confession to channel
  const sentMessage = await confessionChannel.send({ embeds: [confessionEmbed], components: [row] });

  // Track this confession
  await confessionService.addConfession(guild.id, confessionId, sentMessage.id, user.id);

  // Confirm to user
  const confirmEmbed = new EmbedBuilder()
    .setColor(config.colors.success)
    .setDescription(`${config.emojis.success} <@${user.id}>: Your confession has **been submitted**. Confession ID: **${confessionId}**`);

  if (isInteraction) {
    return context.reply({ embeds: [confirmEmbed], ephemeral: true }); // Keep confirmation ephemeral for privacy!
  } else {
    return context.channel.send({ embeds: [confirmEmbed] });
  }
}

module.exports = {
  // PREFIX COMMAND
  name: "confession",
  aliases: [],
  description: "Manage the confession system",
  permission: 'Manage Server',
  isGroupCommand: true,
  run: async (client, message, args) => {
    try {
      const confessionService = getService('confession');

      // Normalize subcommand to lowercase
      const subcommand = args[0]?.toLowerCase();

      if (subcommand === 'channel') {

        const subcommandInfo = {
          description: 'Set or view the confession channel',
          usage: '{guildprefix}confession channel [#channel]',
          aliases: [],
          parameters: ['channel (optional)'],
          example: '{guildprefix}confession channel #confessions'
        };

        // Check permissions for config commands
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return embeds.deny(message, 'You need **Manage Server** permission to use this command', false);
        }

        if (!args[1]) {
          return await viewConfessionChannelShared(message, confessionService);
        }

        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
        if (!channel) {
          return embeds.deny(message, 'Invalid channel provided', false);
        }

        if (!channel.isTextBased()) {
          return embeds.deny(message, 'Confession channel must be a text channel', false);
        }

        return await setConfessionChannelShared(message, channel, confessionService);

      } else if (subcommand === 'blacklist') {
        const subcommandInfo = {
          description: 'Add or remove users from the confession blacklist',
          usage: '{guildprefix}confession blacklist [@user]',
          aliases: [],
          parameters: ['user (optional)'],
          example: '{guildprefix}confession blacklist @user'
        };

        // Check permissions for config commands
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return embeds.deny(message, 'You need **Manage Server** permission to use this command', false);
        }

        if (!args[1]) {
          return await viewBlacklistedUsersShared(message, confessionService);
        }

        const user = message.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);
        if (!user) {
          return embeds.deny(message, 'Invalid user provided', false);
        }

        return await toggleBlacklistUserShared(message, user, confessionService);

      } else if (subcommand === 'config') {
        const subcommandInfo = {
          description: 'View the confession system configuration',
          usage: '{guildprefix}confession config',
          aliases: [],
          parameters: [],
          example: '{guildprefix}confession config'
        };

        // Check permissions for config commands
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return embeds.deny(message, 'You need **Manage Server** permission to use this command', false);
        }

        return await viewConfessionConfigShared(message, confessionService);

      } else if (subcommand === 'toggle' || subcommand === 'enable' || subcommand === 'disable') {
        // Check permissions for config commands
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return embeds.deny(message, 'You need **Manage Server** permission to use this command', false);
        }

        const confessionConfig = await confessionService.getConfessionConfig(message.guild.id);
        const newStatus = subcommand === 'disable' ? false : !confessionConfig.enabled;

        await confessionService.setConfessionEnabled(message.guild.id, newStatus);

        return embeds.success(message, `Confession system ${newStatus ? 'enabled' : 'disabled'}`, false);

      } else {
        // Show help for invalid subcommand
        return runHelpCommand(message, 'confession');
      }
    } catch (error) {
      console.error('Error in confession command:', error);

      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Confession Command', {
          command: 'confession',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }

      return embeds.deny(message, 'An error occurred while executing the confession command.', false);
    }
  },

  // SLASH COMMANDS (two separate commands)
  data: [
    // /confess - Simple confession submission
    new SlashCommandBuilder()
      .setName('confess')
      .setDescription('Submit an anonymous confession')
      .addStringOption(option =>
        option
          .setName('confession')
          .setDescription('Your anonymous confession')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(2000)
      ),

    // /confession - Management with subcommands
    new SlashCommandBuilder()
      .setName('confession')
      .setDescription('Manage the confession system')
      .addSubcommand(subcommand =>
        subcommand
          .setName('channel')
          .setDescription('Set or view the confession channel')
          .addChannelOption(option =>
            option
              .setName('channel')
              .setDescription('The channel for confessions')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('blacklist')
          .setDescription('Add or remove a user from the confession blacklist')
          .addUserOption(option =>
            option
              .setName('user')
              .setDescription('The user to blacklist/unblacklist')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('config')
          .setDescription('View the confession system configuration')
      )
  ],

  async execute(interaction) {
    try {
      const confessionService = getService('confession');

      // Handle /confess command (simple submission)
      if (interaction.commandName === 'confess') {
        const confessionText = interaction.options.getString('confession');
        return await submitConfession(interaction, confessionText);
      }

      // Handle /confession command (management)
      if (interaction.commandName === 'confession') {
        const subcommand = interaction.options.getSubcommand();

        // CHANNEL subcommand
        if (subcommand === 'channel') {
          // Check permissions
          if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return embeds.deny(interaction, 'You need **Manage Server** permission to use this command', false);
          }

          const channel = interaction.options.getChannel('channel');

          // If no channel provided, show current
          if (!channel) {
            return await viewConfessionChannelShared(interaction, confessionService);
          }

          // Validate channel
          if (!channel.isTextBased()) {
            return embeds.deny(interaction, 'Confession channel must be a text channel', false);
          }

          return await setConfessionChannelShared(interaction, channel, confessionService);
        }

        // BLACKLIST subcommand
        if (subcommand === 'blacklist') {
          // Check permissions
          if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return embeds.deny(interaction, 'You need **Manage Server** permission to use this command', false);
          }

          const user = interaction.options.getUser('user');

          // If no user provided, show list
          if (!user) {
            return await viewBlacklistedUsersShared(interaction, confessionService);
          }

          // Toggle blacklist status
          return await toggleBlacklistUserShared(interaction, user, confessionService);
        }

        // CONFIG subcommand
        if (subcommand === 'config') {
          // Check permissions
          if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return embeds.deny(interaction, 'You need **Manage Server** permission to use this command', false);
          }

          return await viewConfessionConfigShared(interaction, confessionService);
        }
      }

    } catch (error) {
      console.error('Error in /confession command:', error);

      if (interaction.client?.errorLogger) {
        interaction.client.errorLogger.log(error, 'Slash Confession Command', {
          command: '/confession',
          subcommand: interaction.options.getSubcommand(),
          user: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel
        });
      }

      return embeds.deny(interaction, 'An error occurred while executing the command.', false).catch(() => { });
    }
  }
};