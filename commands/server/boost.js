const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embedbuilder');
const config = require('../../config/setup');
const { findChannel, findRole } = require('../../handlers/finder');
const { getService } = require('@services');

module.exports = {
  name: "boost",
  aliases: ['boosts'],
  description: `Set up a boost message and role for when members boost the server`,
  permission: "Manage Guild",
  isGroupCommand: true,

  run: async(client, message, args) => {
    const guildService = getService('guild');

    // Show help if no subcommand provided
    if (!args[0]) return false;

    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Add or update a boost message for a channel',
        usage: '{guildprefix}boost add [channel] [message]',
        aliases: [],
        parameters: ['channel', 'message'],
        example: '{guildprefix}boost add #boosts Thanks for boosting {user.mention}!'
      };

      const channelInput = args[1];
      const boostmessage = args.slice(2).join(' ');

      if (!channelInput || !boostmessage) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const boostchannel = channelResult.channel;

      // Check boost message limit (5 max)
      const currentBoostMessages = await guildService.getBoostMessages(message.guild.id) || [];
      const existingBoostMessage = currentBoostMessages.find(bm => bm.channelId === boostchannel.id);

      if (!existingBoostMessage && currentBoostMessages.length >= 5) {
        return embeds.deny(message, 'You have reached the **maximum boost messages (5)**. Please remove some first.');
      }

      try {

        // Add boost message using new cache system
        await guildService.addBoostMessage(message.guild.id, boostchannel.id, boostmessage);

        const action = existingBoostMessage ? 'Updated the' : 'Created a';
        return embeds.success(message, `${action} **boost message** for ${boostchannel}`);
      } catch (error) {
        console.error('Boost add error:', error);
        return embeds.deny(message, `Failed to set boost message: ${error.message}`);
      }

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        description: 'Remove a boost message from a channel',
        usage: '{guildprefix}boost remove [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}boost remove #boosts'
      };

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const boostchannel = channelResult.channel;

      // Check if boost message exists for this channel
      const existingBoostMessage = await guildService.getBoostMessage(message.guild.id, boostchannel.id);
      if (!existingBoostMessage) {
        return embeds.warn(message, `No **boost message** exists for ${boostchannel}`);
      }

      try {
        // Remove boost message using new cache system
        await guildService.removeBoostMessage(message.guild.id, boostchannel.id);

        return embeds.success(message, `Removed the **boost message** for ${boostchannel}`);
      } catch (error) {
        console.error('Boost remove error:', error);
        return embeds.deny(message, `Failed to remove boost message: ${error.message}`);
      }


    } else if (args[0] === 'view') {
      const subcommandInfo = {
        description: 'Preview the boost message for a channel',
        usage: '{guildprefix}boost view [channel]',
        aliases: [],
        parameters: ['channel'],
        example: '{guildprefix}boost view #boosts'
      };

      const channelInput = args[1];
      if (!channelInput) return false;

      // Use universal finder for channel detection
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) return false;

      const boostchannel = channelResult.channel;

      // Check if boost message exists for this channel
      const existingBoostMessage = await guildService.getBoostMessage(message.guild.id, boostchannel.id);
      if (!existingBoostMessage) {
        return embeds.warn(message, `No **boost message** to preview for ${boostchannel}`);
      }

      // Use EmbedVariableProcessor to handle the boost message with variables
      EmbedVariableProcessor.process(message.channel, existingBoostMessage.message, {
        user: message.author,
        guild: message.guild,
        channel: boostchannel
      });

    } else if (args[0] === 'variables') {
      const subcommandInfo = {
        description: 'Shows available variables for boost messages',
        usage: '{guildprefix}boost variables',
        aliases: [],
        parameters: [],
        example: '{guildprefix}boost variables'
      };

      const member = message.author;
      const ordinal = (message.guild.memberCount.toString().endsWith(1) && !message.guild.memberCount.toString().endsWith(11)) ? 'st' : (message.guild.memberCount.toString().endsWith(2) && !message.guild.memberCount.toString().endsWith(12)) ? 'nd' : (message.guild.memberCount.toString().endsWith(3) && !message.guild.memberCount.toString().endsWith(13)) ? 'rd' : 'th';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Boost Message Variables')
        .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{server.humanmembercount}\` — ${message.guild.memberCount + ordinal}\n\`{server.boostcount}\` — ${message.guild.premiumSubscriptionCount}\n\`{server.boostlevel}\` — ${message.guild.premiumTier}`);

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'role') {
      const subcommandInfo = {
        description: 'Set or remove the boost role',
        usage: '{guildprefix}boost role [@role/none]',
        aliases: [],
        parameters: ['role'],
        example: '{guildprefix}boost role @Booster'
      };

      const roleInput = args[1];
      if (!roleInput) return false;

      if (roleInput.toLowerCase() === 'none') {
        // Remove boost role
        await guildService.removeBoostRole(message.guild.id);
        return embeds.success(message, 'Removed the **boost role**');
      }

      // Find the role using universal finder
      const roleResult = message.mentions.roles.first() ?
        { found: true, role: message.mentions.roles.first() } :
        findRole(message.guild, roleInput);

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error || 'Could not find that role');
      }

      const boostRole = roleResult.role;

      // Check if bot can manage this role
      if (boostRole.position >= message.guild.members.me.roles.highest.position) {
        return embeds.deny(message, 'I cannot manage that role as it is higher than or equal to my highest role');
      }

      // Check if role is manageable
      if (!boostRole.editable) {
        return embeds.deny(message, 'I do not have permission to manage that role');
      }

      // Set the boost role
      await guildService.setBoostRole(message.guild.id, boostRole.id);
      return embeds.success(message, `Set **${boostRole.name}** as the boost role`);

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'Lists all configured boost messages',
        usage: '{guildprefix}boost list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}boost list'
      };

      const boostMessages = await guildService.getBoostMessages(message.guild.id) || [];

      if (boostMessages.length === 0) {
        return embeds.warn(message, 'No **boost messages** have been setup yet');
      }

      const messageList = boostMessages.map((bm, index) => {
        const channel = message.guild.channels.cache.get(bm.channelId);
        const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${bm.channelId})`;
        const messageNumber = (index + 1).toString().padStart(2, '0');
        return `\`${messageNumber}\` ${channelName}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Boost Messages')
        .setDescription(messageList)
        .setFooter({ text: `${boostMessages.length} boost message${boostMessages.length === 1 ? '' : 's'}` });

      return message.channel.send({ embeds: [embed] });

    } else {
      // Invalid subcommand - show help
      return false;
    }
  }
}
