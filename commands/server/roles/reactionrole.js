const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { checkUserRoleHierarchy, checkBotRoleHierarchy } = require('../../../utils/permissions');
const { ensureGuildData } = require('../../../database');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');

module.exports = {
  name: "reactionrole",
  aliases: ['rr'],
  description: `Manage reaction roles`,
  permission: 'Manage Roles',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Add a reaction role to a message',
        usage: '{guildprefix}reactionrole add [message_link] [reaction] [role]',
        aliases: [],
        parameters: ['message_link', 'reaction', 'role'],
        example: '{guildprefix}reactionrole add https://discord.com/channels/.../... 🌟 @Member'
      };

      const messageLink = args[1];
      const reaction = args[2];
      const roleName = args.slice(3).join(' ');

      if (!messageLink || !reaction || !roleName) {
        return false;
      }

      // Parse message link
      const linkMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
      if (!linkMatch) {
        return embeds.deny(message, 'Invalid message link format!');
      }

      const [, guildId, channelId, messageId] = linkMatch;
      
      if (guildId !== message.guild.id) {
        return embeds.deny(message, 'Message must be from this server!');
      }

      // Get channel and message
      const channel = message.guild.channels.cache.get(channelId);
      if (!channel) {
        return embeds.deny(message, 'Channel not found!');
      }

      let targetMessage;
      try {
        targetMessage = await channel.messages.fetch(messageId);
      } catch (error) {
        return embeds.deny(message, 'Message not found!');
      }

      // Find role
      const roleResult = message.mentions.roles.first() ?
        { found: true, role: message.mentions.roles.first() } :
        findRole(message.guild, roleName);

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Check if role has dangerous permissions
      if (role.permissions.has(PermissionFlagsBits.Administrator) || 
          role.permissions.has(PermissionFlagsBits.ManageGuild) ||
          role.permissions.has(PermissionFlagsBits.ManageRoles) ||
          role.permissions.has(PermissionFlagsBits.ManageChannels) ||
          role.permissions.has(PermissionFlagsBits.BanMembers) ||
          role.permissions.has(PermissionFlagsBits.KickMembers)) {
        return embeds.deny(message, `**${role.name}** is an admin/management role and cannot be used for reaction roles!`);
      }

      // Hierarchy checks
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Get current reaction roles
      const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];

      // Check if this message + reaction combo already exists
      const existingReactionRole = reactionRoles.find(rr => 
        rr.messageId === messageId && rr.reaction === reaction
      );

      if (existingReactionRole) {
        return embeds.deny(message, 'This message and reaction combination already has a role assigned!');
      }

      // Check limit (max 50 reaction roles per server)
      if (reactionRoles.length >= 50) {
        return embeds.deny(message, 'You have reached the maximum limit of **50 reaction roles** per server!');
      }

      // Add reaction to message
      try {
        await targetMessage.react(reaction);
      } catch (error) {
        return embeds.deny(message, 'Failed to add reaction to message! Make sure the emoji is valid.');
      }

      // Save to database
      await guildService.addReactionRole(message.guild.id, {
        messageId: messageId,
        channelId: channelId,
        reaction: reaction,
        roleId: role.id
      });

      return embeds.success(message, `Added ${reaction} to [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}) with ${role} assigned`);

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        description: 'Remove a reaction role from a message',
        usage: '{guildprefix}reactionrole remove [message_link] [reaction]',
        aliases: [],
        parameters: ['message_link', 'reaction'],
        example: '{guildprefix}reactionrole remove https://discord.com/channels/.../... 🌟'
      };

      const messageLink = args[1];
      const reaction = args[2];

      if (!messageLink || !reaction) {
        return false;
      }

      // Parse message link
      const linkMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
      if (!linkMatch) {
        return embeds.deny(message, 'Invalid message link format!');
      }

      const [, guildId, channelId, messageId] = linkMatch;
      
      if (guildId !== message.guild.id) {
        return embeds.deny(message, 'Message must be from this server!');
      }

      // Get current reaction roles
      const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];

      // Find the reaction role
      const reactionRole = reactionRoles.find(rr => 
        rr.messageId === messageId && rr.reaction === reaction
      );

      if (!reactionRole) {
        return embeds.deny(message, 'No reaction role found for this message and reaction!');
      }

      // Remove from database
      await guildService.removeReactionRole(message.guild.id, messageId, reaction);

      // Try to remove bot's reaction from message
      try {
        const channel = message.guild.channels.cache.get(channelId);
        if (channel) {
          const targetMessage = await channel.messages.fetch(messageId);
          const reactionObj = targetMessage.reactions.cache.find(r => r.emoji.name === reaction || r.emoji.toString() === reaction);
          if (reactionObj) {
            await reactionObj.users.remove(client.user.id);
          }
        }
      } catch (error) {
        // Ignore errors when removing reaction
      }

      const role = message.guild.roles.cache.get(reactionRole.roleId);
      const roleMention = role ? `${role}` : '**Unknown Role**';

      return embeds.success(message, `Removed ${reaction} from [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}) with ${roleMention} unassigned`);

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all reaction roles in the server',
        usage: '{guildprefix}reactionrole list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}reactionrole list'
      };

      const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];

      if (reactionRoles.length === 0) {
        return embeds.warn(message, 'No reaction roles found!');
      }

      // Clean up invalid roles and group by message
      const validReactionRoles = [];
      const messageGroups = {};

      for (const rr of reactionRoles) {
        const role = message.guild.roles.cache.get(rr.roleId);
        if (role) {
          validReactionRoles.push(rr);
          if (!messageGroups[rr.messageId]) {
            messageGroups[rr.messageId] = [];
          }
          messageGroups[rr.messageId].push({
            reaction: rr.reaction,
            role: role,
            channelId: rr.channelId
          });
        } else {
          // Remove invalid role from database
          await guildService.removeReactionRole(message.guild.id, rr.messageId, rr.reaction);
        }
      }

      if (validReactionRoles.length === 0) {
        return embeds.warn(message, 'No valid reaction roles found!');
      }

      let description = '';
      let count = 0;

      for (const [messageId, roles] of Object.entries(messageGroups)) {
        for (const roleData of roles) {
          count++;
          description += `\`${count}\` ${roleData.reaction} [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${roleData.channelId}/${messageId}) - ${roleData.role}\n`;
        }
      }

      const totalPages = 1;
      const currentPage = 1;
      const entryText = validReactionRoles.length === 1 ? 'entry' : 'entries';

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setAuthor({ name: 're.voro', iconURL: 'https://cdn.discordapp.com/embed/avatars/5.png' })
        .setTitle('Reaction Roles')
        .setDescription(description.trim())
        .setFooter({ text: `Page ${currentPage}/${totalPages} (${validReactionRoles.length} ${entryText})` });

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Remove all reaction roles from the server',
        usage: '{guildprefix}reactionrole reset',
        aliases: ['clear'],
        parameters: [],
        example: '{guildprefix}reactionrole reset'
      };

      const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];

      if (reactionRoles.length === 0) {
        return embeds.warn(message, 'No reaction roles found!');
      }

      await createConfirmation(
        message,
        'Are you sure you want to **remove all reaction roles**?',
        async (interaction) => {
          await guildService.clearAllReactionRoles(message.guild.id);
          const successEmbed = embeds.createSuccess(message, 'Removed all reaction roles');
          await interaction.update({ embeds: [successEmbed], components: [] });
        }
      );

    } else if (args[0] === 'removeall') {
      const subcommandInfo = {
        description: 'Remove all reaction roles from a specific message',
        usage: '{guildprefix}reactionrole removeall [message_link]',
        aliases: [],
        parameters: ['message_link'],
        example: '{guildprefix}reactionrole removeall https://discord.com/channels/.../...'
      };

      const messageLink = args[1];

      if (!messageLink) {
        return false;
      }

      // Parse message link
      const linkMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
      if (!linkMatch) {
        return embeds.deny(message, 'Invalid message link format!');
      }

      const [, guildId, channelId, messageId] = linkMatch;
      
      if (guildId !== message.guild.id) {
        return embeds.deny(message, 'Message must be from this server!')
      }

      // Get current reaction roles for this message
      const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];
      const messageReactionRoles = reactionRoles.filter(rr => rr.messageId === messageId);

      if (messageReactionRoles.length === 0) {
        return embeds.deny(message, 'No reaction roles found for this message!');
      }

      await createConfirmation(
        message,
        `Are you sure you want to **remove all ${messageReactionRoles.length} reaction roles** from this message?`,
        async (interaction) => {
          // Remove all reaction roles for this message
          for (const rr of messageReactionRoles) {
            await guildService.removeReactionRole(message.guild.id, messageId, rr.reaction);
          }

          // Try to remove bot's reactions from message
          try {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
              const targetMessage = await channel.messages.fetch(messageId);
              for (const rr of messageReactionRoles) {
                const reactionObj = targetMessage.reactions.cache.find(r => 
                  r.emoji.name === rr.reaction || r.emoji.toString() === rr.reaction
                );
                if (reactionObj) {
                  await reactionObj.users.remove(client.user.id);
                }
              }
            }
          } catch (error) {
            // Ignore errors when removing reactions
          }

          const successEmbed = embeds.createSuccess(message, `Removed all reaction roles from [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId})`);
          await interaction.update({ embeds: [successEmbed], components: [] });
        }
      );

    } else {
      return false;
    }
  }
}