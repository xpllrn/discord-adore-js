const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embedbuilder');
const config = require('../../config/setup');
const { getService } = require('@services');

module.exports = {
  name: "level",
  aliases: ['lvl'],
  description: `Set up custom level up messages for when members level up`,
  permission: "Manage Guild",
  isGroupCommand: true,

  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!args[0]) return false;

    // Ensure guild data exists in the database
    const globaldata = await ensureGuildData(message.guild.id);

    if (args[0] === 'message') {
      const subcommandInfo = {
        description: 'Set custom level up message',
        usage: '{guildprefix}level message [message/remove/none]',
        aliases: [],
        parameters: ['message'],
        example: '{guildprefix}level message {user.mention} leveled up to {level.new_rank}!'
      };

      if (!args[1]) return false;

      try {
        const levelMessage = args.slice(1).join(' ');

        // Handle remove/none command
        if (levelMessage.toLowerCase() === 'remove' || levelMessage.toLowerCase() === 'none') {
          await guildService.removeLevelCustomMessage(message.guild.id);
          return embeds.success(message, "Custom level message has been removed. The default message will now be used.");
        }

        // Check if the message contains the required {level.new_rank} variable
        if (!levelMessage.includes('{level.new_rank}')) {
          return embeds.deny(message, 'Level up messages **must** include the `{level.new_rank}` variable to show the user\'s new level.');
        }

        // Set the custom message
        await guildService.setLevelCustomMessage(message.guild.id, levelMessage);

        return embeds.success(message, "Custom level message has been set successfully!");
      } catch (error) {
        console.error('Level message error:', error);
        return embeds.deny(message, `Failed to set level message: ${error.message}`);
      }

    } else if (args[0] === 'message' && args[1] === 'view') {
      const subcommandInfo = {
        description: 'Preview the current level up message',
        usage: '{guildprefix}level message view',
        aliases: [],
        parameters: [],
        example: '{guildprefix}level message view'
      };

      const customMessage = await guildService.getLevelCustomMessage(message.guild.id);

      if (customMessage) {
        // Use EmbedVariableProcessor to handle the custom message with variables
        EmbedVariableProcessor.process(message.channel, customMessage, {
          user: message.author,
          guild: message.guild,
          channel: message.channel,
          level: { new_rank: 25 } // Example level for preview
        });
      } else {
        // Show default message preview
        const { colors } = require('../../config/setup');
        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL({ dynamic: true })
          })
          .setDescription(`**${message.member?.displayName || message.author.username}** had **leveled up**!\n> They are now **level 25**, yayyyyy`)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

        return message.channel.send({ 
          content: `**Preview of default level message:**\n${message.author}`,
          embeds: [embed] 
        });
      }

    } else if (args[0] === 'variables') {
      const subcommandInfo = {
        description: 'Shows available variables for level up messages',
        usage: '{guildprefix}level variables',
        aliases: [],
        parameters: [],
        example: '{guildprefix}level variables'
      };

      const member = message.author;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Level Up Message Variables')
        .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{level.new_rank}\` — Member's new level at time of level up`);

      return message.channel.send({ embeds: [embed] });

    } else {
      // Invalid subcommand - show help
      return false;
    }
  }
}