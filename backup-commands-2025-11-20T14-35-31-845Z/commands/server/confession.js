const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../utils/commandProcessor');
const config = require('../../config/setup');

module.exports = {
  name: "confession",
  aliases: ['confess'],
  description: "Manage the confession system",
  permission: 'Manage Server',
  isGroupCommand: true,
  run: async (client, message, args) => {
    try {
      const confessionService = getService('confession');

    if (args[0] === 'channel') {
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

    } else if (args[0] === 'ignore') {
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

    } else if (args[0] === 'config') {
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

    } else {
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
  }
};
