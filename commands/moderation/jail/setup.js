const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { colors, emojis } = require('../../../config/setup');
const { findRole, findChannel } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "setup",
  aliases: ['setme'],
  description: `automatically setup jail role and channel with proper permissions`,
  syntax: 'setup',
  example: 'setup',
  permission: 'Administrator',
  cooldown: 900000, // 15 minutes in milliseconds
  run: async (client, message, args) => {

    // Permission checks first - Admin only
    if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return embeds.deny(message, 'I need **Manage Roles** permission to use this command');
    }

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    // Send loading embed
    const loadingMessage = await embeds.loading(message, 'setting up the **moderation setup**, please wait..');

    try {
      // Check if jail role already exists using universal finder
      const jailRoleResult = findRole(message.guild, 'jailed');
      let jailRole = jailRoleResult.found ? jailRoleResult.role : null;
      let roleCreated = false;

      if (!jailRole) {
        // Create jail role with no color
        jailRole = await message.guild.roles.create({
          name: 'jailed',
          reason: `Jail setup by ${message.author.tag}`
        });
        roleCreated = true;
      }

      // Check if jail channel already exists using universal finder
      const jailChannelResult = findChannel(message.guild, 'jail');
      let jailChannel = jailChannelResult.found ? jailChannelResult.channel : null;
      let channelCreated = false;

      if (!jailChannel) {
        // Create jail channel
        jailChannel = await message.guild.channels.create({
          name: 'jail',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: message.guild.id, // @everyone
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: jailRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ],
              deny: [
                PermissionFlagsBits.MentionEveryone,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AddReactions
              ]
            }
          ],
          reason: `Jail setup by ${message.author.tag}`
        });

        // Move jail channel to top
        await jailChannel.setPosition(0);
        channelCreated = true;
      }

      // Check if mod-logs channel already exists
      const logsChannelResult = findChannel(message.guild, 'mod-logs');
      let logsChannel = logsChannelResult.found ? logsChannelResult.channel : null;
      let logsChannelCreated = false;

      if (!logsChannel) {
        // Create mod-logs channel
        logsChannel = await message.guild.channels.create({
          name: 'mod-logs',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: message.guild.id, // @everyone
              deny: [PermissionFlagsBits.ViewChannel],
            }
          ],
          reason: `Moderator logs setup by ${message.author.tag}`
        });
        logsChannelCreated = true;
      }

      const allChannels = message.guild.channels.cache.filter(channel =>
        channel.id !== jailChannel.id
      );

      let permissionUpdates = 0;
      for (const [, channel] of allChannels) {
        try {
          const permissions = {
            ViewChannel: false
          };

          // Add specific permissions based on channel type
          if (channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement ||
            channel.type === ChannelType.GuildForum ||
            channel.type === ChannelType.GuildMedia) {
            // Text-based channels
            permissions.SendMessages = false;
            permissions.AddReactions = false;
            permissions.CreatePublicThreads = false;
            permissions.CreatePrivateThreads = false;
            permissions.SendMessagesInThreads = false;
          }

          if (channel.type === ChannelType.GuildVoice ||
            channel.type === ChannelType.GuildStageVoice) {
            // Voice channels
            permissions.Connect = false;
            permissions.Speak = false;
            permissions.Stream = false;
            permissions.UseVAD = false;
          }

          await channel.permissionOverwrites.edit(jailRole, permissions);
          permissionUpdates++;
        } catch (error) {
          // Ignore permission errors for individual channels
        }
      }

      // Send jail channel welcome message only if channel was just created
      if (jailChannel && channelCreated) {
        const jailWelcomeEmbed = new EmbedBuilder()
          .setColor('#415159')
          .setTitle('Welcome to the basement')
          .setDescription('> If you\'ve been **locked** here, Please wait here **patiently** for a staff member to discuss your **punishment**')
          .setFooter({ text: 'Please do not mention, can lead to increase in punishment' })
          .setThumbnail('https://media.discordapp.net/attachments/1379150778354372678/1380449503366221895/pngwing.com_1.png?ex=6843eb49&is=684299c9&hm=114f359ef41a695ea8799a2931654295eadee44b48d13add93e394c1be706117&=&format=webp&quality=lossless&width=1706&height=1706');

        await jailChannel.send({ embeds: [jailWelcomeEmbed] });
      }

      // Save jail role and channel IDs to database using service layer
      const { getService } = require('@services');
      const guildService = getService('guild');

      try {
        await guildService.setJail(message.guild.id, jailRole.id, jailChannel.id);
      } catch (error) {
        logger.webhook.error(error, message);
        await loadingMessage.delete();
        return embeds.deny(message, `Jail system was **created but failed** to save to database.`);
      }

      // Set up moderator logging in mod-logs channel if it was created
      if (logsChannel && logsChannelCreated) {
        try {
          // Create webhook for logging
          const webhook = await logsChannel.createWebhook({
            name: `adore Audits`,
            avatar: client.user.displayAvatarURL({ format: 'png' }),
            reason: `Jail logging setup by ${message.author.tag}`
          });

          // Set up moderator logging
          await guildService.setLoggingChannel(
            message.guild.id,
            logsChannel.id,
            webhook.url,
            ['moderator'],
            message.author.id
          );
        } catch (error) {
          // Log error but don't fail the entire setup
          logger.webhook.error(error, message);
        }
      }

      await loadingMessage.delete();
      
      embeds.success(message, '**Moderation system** set up has been completed');

      // Log the jail setup action
      await logJailSetup(message.author, jailRole, jailChannel, logsChannel, message.guild, roleCreated, channelCreated, logsChannelCreated, permissionUpdates);

    } catch (error) {
      // Update loading message with error
      logger.webhook.error(error, message);

      // Log error to webhook if available
      if (message.client?.errorLogger) {
        message.client.errorLogger.log(error, 'Jail Setup Command', {
          command: 'jailsetup',
          args: args.join(' '),
          user: message.author,
          guild: message.guild
        });
      }

      await loadingMessage.delete();
      embeds.deny(message, `An error occurred during jail setup: ${error.message}`);
    }
  }
}

async function logJailSetup(executor, jailRole, jailChannel, logsChannel, guild, roleCreated, channelCreated, logsChannelCreated, permissionUpdates) {
  try {
    const webhookLogger = require('../../../utils/webhookLogger');

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Silent fail for logging
  }
}
