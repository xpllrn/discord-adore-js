const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');

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
      return context.reply({ content: errorMsg, ephemeral: true });
    } else {
      return embeds.deny(context, 'The confession system is not enabled on this server.');
    }
  }

  // Check if user is ignored
  const isIgnored = await confessionService.isUserIgnored(guild.id, user.id);
  if (isIgnored) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: You are **not allowed** to submit confessions in this server.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: true });
    } else {
      return embeds.deny(context, 'You are not allowed to submit confessions in this server.');
    }
  }

  // Get confession channel
  const confessionChannel = guild.channels.cache.get(confessionConfig.channelId);
  if (!confessionChannel) {
    const errorMsg = `${config.emojis.error} <@${user.id}>: The confession channel no longer exists.`;
    if (isInteraction) {
      return context.reply({ content: errorMsg, ephemeral: true });
    } else {
      return embeds.deny(context, 'The confession channel no longer exists.');
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
    return context.reply({ embeds: [confirmEmbed], ephemeral: true });
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
        return embeds.deny(message, 'You need **Manage Server** permission to use this command');
      }
      if (!args[1]) {
        const confessionConfig = await confessionService.getConfessionConfig(message.guild.id);
        if (!confessionConfig.channelId) {
          return embeds.info(message, 'No confession channel is currently set');
        }
        return embeds.info(message, `Current confession channel: <#${confessionConfig.channelId}>`);
      }

      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel) {
        return embeds.deny(message, 'Invalid channel provided');
      }

      if (!channel.isTextBased()) {
        return embeds.deny(message, 'Confession channel must be a text channel');
      }

      await confessionService.setConfessionChannel(message.guild.id, channel.id);
      
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
      
      return embeds.success(message, `Set ${channel} as the confession channel and sent the confession button`);

    } else if (subcommand === 'ignore') {
      const subcommandInfo = {
        description: 'Add or remove users from the confession ignore list',
        usage: '{guildprefix}confession ignore [@user]',
        aliases: [],
        parameters: ['user (optional)'],
        example: '{guildprefix}confession ignore @user'
      };

      // Check permissions for config commands
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(message, 'You need **Manage Server** permission to use this command');
      }
      if (!args[1]) {
        const confessionConfig = await confessionService.getConfessionConfig(message.guild.id);
        if (confessionConfig.ignoredUsers.length === 0) {
          return embeds.info(message, 'No users are currently ignored');
        }
        const userList = confessionConfig.ignoredUsers.map(id => `<@${id}>`).join(', ');
        return embeds.info(message, `Ignored users: ${userList}`);
      }

      const user = message.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);
      if (!user) {
        return embeds.deny(message, 'Invalid user provided');
      }

      const isIgnored = await confessionService.isUserIgnored(message.guild.id, user.id);
      if (isIgnored) {
        await confessionService.removeIgnoredUser(message.guild.id, user.id);
        return embeds.success(message, `Removed ${user} from the confession ignore list`);
      } else {
        await confessionService.addIgnoredUser(message.guild.id, user.id);
        return embeds.success(message, `Added ${user} to the confession ignore list`);
      }

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
        return embeds.deny(message, 'You need **Manage Server** permission to use this command');
      }
      const confessionConfig = await confessionService.getConfessionConfig(message.guild.id);
      
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setAuthor({ 
          name: message.author.username, 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
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
            name: 'Ignored Users',
            value: confessionConfig.ignoredUsers.length > 0 ? confessionConfig.ignoredUsers.map(id => `<@${id}>`).join(', ') : 'None',
            inline: false
          },
          {
            name: 'Next Confession ID',
            value: `#${confessionConfig.nextConfessionId}`,
            inline: true
          }
        )
        .setFooter({ text: `Guild ID: ${message.guild.id}` })

      return message.channel.send({ embeds: [embed] });

    } else if (subcommand === 'toggle' || subcommand === 'enable' || subcommand === 'disable') {
      // Check permissions for config commands
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return embeds.deny(message, 'You need **Manage Server** permission to use this command');
      }
      
      const confessionConfig = await confessionService.getConfessionConfig(message.guild.id);
      const newStatus = subcommand === 'disable' ? false : !confessionConfig.enabled;
      
      await confessionService.setConfessionEnabled(message.guild.id, newStatus);
      
      return embeds.success(message, `Confession system ${newStatus ? 'enabled' : 'disabled'}`);

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
      
      return embeds.deny(message, 'An error occurred while executing the confession command.');
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
          .setName('ignore')
          .setDescription('Add or remove a user from the confession ignore list')
          .addUserOption(option =>
            option
              .setName('user')
              .setDescription('The user to ignore/unignore')
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
          return interaction.reply({
            content: `${config.emojis.error} You need **Manage Server** permission to use this command`,
            ephemeral: true
          });
        }

        const channel = interaction.options.getChannel('channel');
        
        // If no channel provided, show current
        if (!channel) {
          const confessionConfig = await confessionService.getConfessionConfig(interaction.guild.id);
          if (!confessionConfig.channelId) {
            return interaction.reply({
              content: 'No confession channel is currently set',
              ephemeral: true
            });
          }
          return interaction.reply({
            content: `Current confession channel: <#${confessionConfig.channelId}>`,
            ephemeral: true
          });
        }

        // Validate channel
        if (!channel.isTextBased()) {
          return interaction.reply({
            content: `${config.emojis.error} Confession channel must be a text channel`,
            ephemeral: true
          });
        }

        // Set channel
        await confessionService.setConfessionChannel(interaction.guild.id, channel.id);
        
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
        
        return interaction.reply({
          content: `${config.emojis.success} Set ${channel} as the confession channel and sent the confession button`,
          ephemeral: true
        });
      }

        // IGNORE subcommand
        if (subcommand === 'ignore') {
        // Check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({
            content: `${config.emojis.error} You need **Manage Server** permission to use this command`,
            ephemeral: true
          });
        }

        const user = interaction.options.getUser('user');
        
        // If no user provided, show list
        if (!user) {
          const confessionConfig = await confessionService.getConfessionConfig(interaction.guild.id);
          if (confessionConfig.ignoredUsers.length === 0) {
            return interaction.reply({
              content: 'No users are currently ignored',
              ephemeral: true
            });
          }
          const userList = confessionConfig.ignoredUsers.map(id => `<@${id}>`).join(', ');
          return interaction.reply({
            content: `Ignored users: ${userList}`,
            ephemeral: true
          });
        }

        // Toggle ignore status
        const isIgnored = await confessionService.isUserIgnored(interaction.guild.id, user.id);
        if (isIgnored) {
          await confessionService.removeIgnoredUser(interaction.guild.id, user.id);
          return interaction.reply({
            content: `${config.emojis.success} Removed ${user} from the confession ignore list`,
            ephemeral: true
          });
        } else {
          await confessionService.addIgnoredUser(interaction.guild.id, user.id);
          return interaction.reply({
            content: `${config.emojis.success} Added ${user} to the confession ignore list`,
            ephemeral: true
          });
        }
      }

        // CONFIG subcommand
        if (subcommand === 'config') {
        // Check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({
            content: `${config.emojis.error} You need **Manage Server** permission to use this command`,
            ephemeral: true
          });
        }

        const confessionConfig = await confessionService.getConfessionConfig(interaction.guild.id);
        
        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setAuthor({ 
            name: interaction.user.username, 
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
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
              name: 'Ignored Users',
              value: confessionConfig.ignoredUsers.length > 0 ? confessionConfig.ignoredUsers.map(id => `<@${id}>`).join(', ') : 'None',
              inline: false
            },
            {
              name: 'Next Confession ID',
              value: `#${confessionConfig.nextConfessionId}`,
              inline: true
            }
          )
          .setFooter({ text: `Guild ID: ${interaction.guild.id}` })

          return interaction.reply({ embeds: [embed], ephemeral: true });
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

      return interaction.reply({
        content: `${config.emojis.error} An error occurred while executing the command.`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};
