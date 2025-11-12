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
    const loadingEmbed = new EmbedBuilder()
      .setColor(colors.info)
      .setDescription(`${emojis.loading} <@${message.author.id}>: Setting up jail system for you, please wait!`);

    const loadingMessage = await message.channel.send({ embeds: [loadingEmbed] });

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
        return embeds.deny(message, `Jail system was created but failed to save to database. Please try running the command again.`);
      }

      await loadingMessage.delete();
      embeds.success(message, 'Jail system setup complete!');

      // Log the jail setup action
      await logJailSetup(message.author, jailRole, jailChannel, message.guild, roleCreated, channelCreated, permissionUpdates);

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

async function logJailSetup(executor, jailRole, jailChannel, guild, roleCreated, channelCreated, permissionUpdates) {
  try {
    const webhookLogger = require('../../../utils/webhookLogger');
    const { EmbedBuilder } = require('discord.js');
    const { colors } = require('../../../config/setup');

    const embed = new EmbedBuilder()
      .setColor(colors.success)
      .setAuthor({ name: `${executor.tag} (${executor.id})`, iconURL: executor.displayAvatarURL() })
      .setTitle('🔧 Jail System Setup')
      .addFields(
        { name: 'Executor', value: `${executor}`, inline: true },
        { name: 'Jail Role', value: `${jailRole} ${roleCreated ? '(Created)' : '(Existing)'}`, inline: true },
        { name: 'Jail Channel', value: `${jailChannel} ${channelCreated ? '(Created)' : '(Existing)'}`, inline: true },
        { name: 'Permissions Updated', value: `${permissionUpdates} channels`, inline: true }
      )
      .setTimestamp();

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Silent fail for logging
  }
}
