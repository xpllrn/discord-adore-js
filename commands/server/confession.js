const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const config = require('../../config/setup');

module.exports = {
  name: "confession",
  aliases: ['confess'],
  description: "Manage the confession system",
  permission: 'Manage Server',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const confessionService = getService('confession');

    // If no args or just "confess", show info embed
    if (!args[0] || args[0] === 'confess') {
      const confessionConfig = await confessionService.getConfessionConfig(message.guild.id);
      
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setAuthor({ 
          name: message.author.username, 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        })
        .setDescription('Please use the confess button below to create a confession')
        .setFooter({ text: 'Anonymous Confession System' });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confession_submit')
            .setLabel('Submit a Confession')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝')
        );

      return message.channel.send({ embeds: [embed], components: [row] });
    }

    // Check permissions for config commands
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return embeds.deny(message, 'You need **Manage Server** permission to use this command');
    }

    if (args[0] === 'channel') {
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
      return embeds.success(message, `Set ${channel} as the confession channel`);

    } else if (args[0] === 'ignore') {
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
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } else {
      return false;
    }
  }
};
