const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { checkUserRoleHierarchy, checkBotRoleHierarchy } = require('../../../utils/permissions');
const { ensureGuildData } = require('../../../database');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');

module.exports = {
  name: "reactionrole",
  aliases: ['rr'],
  description: `Manage reaction roles`,
  syntax: 'reactionrole [subcommand] (parameters)',
  example: 'reactionrole add https://discord.com/channels/.../... 🌟 @Member',
  permission: 'manage_roles',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add a reaction role to a message',
      syntax: '{guildprefix}reactionrole add [message_link] [reaction] [role]',
      parameters: ['message_link', 'reaction', 'role'],
      example: '{guildprefix}reactionrole add https://discord.com/channels/.../... 🌟 @Member',

      handler: async (client, message, args, guildService) => {
        const messageLink = args[0];
        const reaction = args[1];
        const roleName = args.slice(2).join(' ');

        if (!messageLink || !reaction || !roleName) return runHelpCommand(message, 'reactionrole');

        const linkMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
        if (!linkMatch) return embeds.deny(message, 'Invalid message link format!');

        const [, guildId, channelId, messageId] = linkMatch;
        if (guildId !== message.guild.id) return embeds.deny(message, 'Message must be from this server!');

        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) return embeds.deny(message, 'Channel not found!');

        let targetMessage;
        try {
          targetMessage = await channel.messages.fetch(messageId);
        } catch (error) {
          return embeds.deny(message, 'Message not found!');
        }

        const roleResult = findRole(message.guild, roleName);
        if (!roleResult.found) return embeds.deny(message, roleResult.error);

        const role = roleResult.role;

        if (role.permissions.has(PermissionFlagsBits.Administrator) ||
            role.permissions.has(PermissionFlagsBits.ManageGuild) ||
            role.permissions.has(PermissionFlagsBits.ManageRoles) ||
            role.permissions.has(PermissionFlagsBits.ManageChannels) ||
            role.permissions.has(PermissionFlagsBits.BanMembers) ||
            role.permissions.has(PermissionFlagsBits.KickMembers)) {
          return embeds.deny(message, `**${role.name}** is an admin/management role and cannot be used for reaction roles!`);
        }

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];

        const existingReactionRole = reactionRoles.find(rr => rr.messageId === messageId && rr.reaction === reaction);
        if (existingReactionRole) {
          return embeds.deny(message, 'This message and reaction combination already has a role assigned!');
        }

        if (reactionRoles.length >= 50) {
          return embeds.deny(message, 'You have reached the maximum limit of **50 reaction roles** per server!');
        }

        try {
          await targetMessage.react(reaction);
        } catch (error) {
          return embeds.deny(message, 'Failed to add reaction to message! Make sure the emoji is valid.');
        }

        await guildService.addReactionRole(message.guild.id, {
          messageId: messageId,
          channelId: channelId,
          reaction: reaction,
          roleId: role.id
        });

        return embeds.success(message, `Added ${reaction} to [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}) with ${role} assigned`);
      }
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove a reaction role from a message',
      syntax: '{guildprefix}reactionrole remove [message_link] [reaction]',
      parameters: ['message_link', 'reaction'],
      example: '{guildprefix}reactionrole remove https://discord.com/channels/.../... 🌟',

      handler: async (client, message, args, guildService) => {
        const messageLink = args[0];
        const reaction = args[1];

        if (!messageLink || !reaction) return runHelpCommand(message, 'reactionrole');

        const linkMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
        if (!linkMatch) return embeds.deny(message, 'Invalid message link format!');

        const [, guildId, channelId, messageId] = linkMatch;
        if (guildId !== message.guild.id) return embeds.deny(message, 'Message must be from this server!');

        const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];
        const reactionRole = reactionRoles.find(rr => rr.messageId === messageId && rr.reaction === reaction);

        if (!reactionRole) {
          return embeds.deny(message, 'No reaction role found for this message and reaction!');
        }

        await guildService.removeReactionRole(message.guild.id, messageId, reaction);

        try {
          const channel = message.guild.channels.cache.get(channelId);
          if (channel) {
            const targetMessage = await channel.messages.fetch(messageId);
            const reactionObj = targetMessage.reactions.cache.find(r => r.emoji.name === reaction || r.emoji.toString() === reaction);
            if (reactionObj) {
              await reactionObj.users.remove(client.user.id);
            }
          }
        } catch (error) { }

        const role = message.guild.roles.cache.get(reactionRole.roleId);
        const roleMention = role ? `${role}` : '**Unknown Role**';

        return embeds.success(message, `Removed ${reaction} from [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}) with ${roleMention} unassigned`);
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all reaction roles in the server',
      syntax: '{guildprefix}reactionrole list',
      parameters: [],
      example: '{guildprefix}reactionrole list',

      handler: async (client, message, args, guildService) => {
        const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];

        if (reactionRoles.length === 0) {
          return embeds.warn(message, 'No reaction roles found!');
        }

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

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Reaction Roles')
          .setDescription(description.trim())
          .setFooter({ text: `${validReactionRoles.length} reaction role${validReactionRoles.length === 1 ? '' : 's'}` });

        return message.channel.send({ embeds: [embed] });
      }
    },

    reset: {
      name: 'reset',
      aliases: ['clear'],
      description: 'Remove all reaction roles from the server',
      syntax: '{guildprefix}reactionrole reset',
      parameters: [],
      example: '{guildprefix}reactionrole reset',

      handler: async (client, message, args, guildService) => {
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
      }
    },

    removeall: {
      name: 'removeall',
      aliases: [],
      description: 'Remove all reaction roles from a specific message',
      syntax: '{guildprefix}reactionrole removeall [message_link]',
      parameters: ['message_link'],
      example: '{guildprefix}reactionrole removeall https://discord.com/channels/.../...',

      handler: async (client, message, args, guildService) => {
        const messageLink = args[0];
        if (!messageLink) return runHelpCommand(message, 'reactionrole');

        const linkMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
        if (!linkMatch) return embeds.deny(message, 'Invalid message link format!');

        const [, guildId, channelId, messageId] = linkMatch;
        if (guildId !== message.guild.id) return embeds.deny(message, 'Message must be from this server!');

        const reactionRoles = await guildService.getReactionRoles(message.guild.id) || [];
        const messageReactionRoles = reactionRoles.filter(rr => rr.messageId === messageId);

        if (messageReactionRoles.length === 0) {
          return embeds.deny(message, 'No reaction roles found for this message!');
        }

        await createConfirmation(
          message,
          `Are you sure you want to **remove all ${messageReactionRoles.length} reaction roles** from this message?`,
          async (interaction) => {
            for (const rr of messageReactionRoles) {
              await guildService.removeReactionRole(message.guild.id, messageId, rr.reaction);
            }

            try {
              const channel = message.guild.channels.cache.get(channelId);
              if (channel) {
                const targetMessage = await channel.messages.fetch(messageId);
                for (const rr of messageReactionRoles) {
                  const reactionObj = targetMessage.reactions.cache.find(r => r.emoji.name === rr.reaction || r.emoji.toString() === rr.reaction);
                  if (reactionObj) {
                    await reactionObj.users.remove(client.user.id);
                  }
                }
              }
            } catch (error) { }

            const successEmbed = embeds.createSuccess(message, `Removed all reaction roles from [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId})`);
            await interaction.update({ embeds: [successEmbed], components: [] });
          }
        );
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'reactionrole');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'reactionrole');
  }
};
