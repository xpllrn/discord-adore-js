const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { checkUserRoleHierarchy, checkBotRoleHierarchy } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');

module.exports = {
  name: "droprole",
  aliases: ['dr'],
  description: `Manage dropdown roles`,
  permission: 'Manage Roles',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Add a dropdown role option to a message',
        usage: '{guildprefix}droprole add [message_link] [role] [emoji] [label]',
        aliases: [],
        parameters: ['message_link', 'role', 'emoji', 'label'],
        example: '{guildprefix}droprole add https://discord.com/channels/.../... @Member 🌟 "Member Role"'
      };

      const messageLink = args[1];
      const roleName = args[2];
      const emoji = args[3];
      const label = args.slice(4).join(' ');

      if (!messageLink || !roleName || !emoji || !label) {
        return runHelpCommand(message, 'droprole');
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
        return embeds.deny(message, `**${role.name}** is an admin/management role and cannot be used for dropdown roles!`);
      }

      // Hierarchy checks
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Get current dropdown roles
      const dropRoles = await guildService.getDropRoles(message.guild.id) || [];

      // Check if this message already has 25 options (Discord limit)
      const messageDropRoles = dropRoles.filter(dr => dr.messageId === messageId);
      if (messageDropRoles.length >= 25) {
        return embeds.deny(message, 'This message already has the maximum of **25 dropdown options**!');
      }

      // Check if this role is already assigned to a dropdown option on this message
      const existingDropRole = messageDropRoles.find(dr => dr.roleId === role.id);
      if (existingDropRole) {
        return embeds.deny(message, `**${role.name}** already has a dropdown option on this message!`);
      }

      // Check global limit (max 200 dropdown roles per server)
      if (dropRoles.length >= 200) {
        return embeds.deny(message, 'You have reached the maximum limit of **200 dropdown roles** per server!');
      }

      // Generate unique option value
      const optionValue = `droprole_${messageId}_${role.id}`;

      // Create select menu option
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(optionValue)
        .setEmoji(emoji);

      // Get existing components or create new ones
      let components = targetMessage.components || [];
      let selectMenu;
      let actionRow;

      // Find existing select menu or create new one
      const existingSelectRow = components.find(row => 
        row.components[0] && row.components[0].type === 3 // StringSelect type
      );

      if (existingSelectRow && existingSelectRow.components[0].options.length < 25) {
        // Add to existing select menu
        selectMenu = StringSelectMenuBuilder.from(existingSelectRow.components[0]);
        actionRow = ActionRowBuilder.from(existingSelectRow);
      } else {
        // Create new select menu
        const menuId = `droprole_menu_${messageId}`;
        selectMenu = new StringSelectMenuBuilder()
          .setCustomId(menuId)
          .setPlaceholder('Select a role...')
          .setMinValues(0)
          .setMaxValues(1);
        
        actionRow = new ActionRowBuilder().addComponents(selectMenu);
        
        // Add to components (select menus go after buttons)
        const buttonRows = components.filter(row => 
          row.components[0] && row.components[0].type === 2 // Button type
        );
        const selectRows = components.filter(row => 
          row.components[0] && row.components[0].type === 3 // StringSelect type
        );
        
        if (selectRows.length >= 5) {
          return embeds.deny(message, 'This message already has the maximum number of component rows!');
        }
        
        components = [...buttonRows, ...selectRows, actionRow];
      }

      selectMenu.addOptions(option);
      actionRow.setComponents(selectMenu);

      // Update message with new dropdown
      try {
        await targetMessage.edit({ components: components });
      } catch (error) {
        return embeds.deny(message, 'Failed to add dropdown option to message! Make sure the emoji is valid.');
      }

      // Save to database
      await guildService.addDropRole(message.guild.id, {
        messageId: messageId,
        channelId: channelId,
        roleId: role.id,
        optionValue: optionValue,
        label: label,
        emoji: emoji
      });

      return embeds.success(message, `Added dropdown role: **${label}** → **${role.name}**`);

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        description: 'Remove a dropdown role option from a message',
        usage: '{guildprefix}droprole remove [message_link] [role]',
        aliases: [],
        parameters: ['message_link', 'role'],
        example: '{guildprefix}droprole remove https://discord.com/channels/.../... @Member'
      };

      const messageLink = args[1];
      const roleName = args[2];

      if (!messageLink || !roleName) {
        return runHelpCommand(message, 'droprole');
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

      // Find role
      const roleResult = message.mentions.roles.first() ?
        { found: true, role: message.mentions.roles.first() } :
        findRole(message.guild, roleName);

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Get current dropdown roles
      const dropRoles = await guildService.getDropRoles(message.guild.id) || [];

      // Find the dropdown role
      const dropRole = dropRoles.find(dr => 
        dr.messageId === messageId && dr.roleId === role.id
      );

      if (!dropRole) {
        return embeds.deny(message, 'No dropdown role found for this message and role!');
      }

      // Get message and update components
      try {
        const channel = message.guild.channels.cache.get(channelId);
        if (channel) {
          const targetMessage = await channel.messages.fetch(messageId);
          
          // Remove the option from select menu
          let components = targetMessage.components || [];
          components = components.map(row => {
            if (row.components[0] && row.components[0].type === 3) { // StringSelect
              const selectMenu = row.components[0];
              const newOptions = selectMenu.options.filter(option => 
                option.value !== dropRole.optionValue
              );
              
              if (newOptions.length === 0) {
                return null; // Remove empty select menu
              }
              
              const newSelectMenu = StringSelectMenuBuilder.from(selectMenu)
                .setOptions(newOptions);
              
              return ActionRowBuilder.from(row).setComponents(newSelectMenu);
            }
            return row;
          }).filter(row => row !== null);

          await targetMessage.edit({ components: components });
        }
      } catch (error) {
        // Continue even if message update fails
      }

      // Remove from database
      await guildService.removeDropRole(message.guild.id, messageId, role.id);

      return embeds.success(message, `Removed dropdown role: **${dropRole.label}** → **${role.name}**`);

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all dropdown roles in the server',
        usage: '{guildprefix}droprole list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}droprole list'
      };

      const dropRoles = await guildService.getDropRoles(message.guild.id) || [];

      if (dropRoles.length === 0) {
        return embeds.warn(message, 'No dropdown roles found!');
      }

      // Clean up invalid roles and group by message
      const validDropRoles = [];
      const messageGroups = {};

      for (const dr of dropRoles) {
        const role = message.guild.roles.cache.get(dr.roleId);
        if (role) {
          validDropRoles.push(dr);
          if (!messageGroups[dr.messageId]) {
            messageGroups[dr.messageId] = [];
          }
          messageGroups[dr.messageId].push({
            label: dr.label,
            role: role,
            channelId: dr.channelId,
            emoji: dr.emoji
          });
        } else {
          // Remove invalid role from database
          await guildService.removeDropRole(message.guild.id, dr.messageId, dr.roleId);
        }
      }

      if (validDropRoles.length === 0) {
        return embeds.warn(message, 'No valid dropdown roles found!');
      }

      let description = '';

      for (const [messageId, roles] of Object.entries(messageGroups)) {
        const channel = message.guild.channels.cache.get(roles[0].channelId);
        const channelMention = channel ? `<#${channel.id}>` : 'Unknown Channel';
        
        description += `**Message:** [Jump to Message](https://discord.com/channels/${message.guild.id}/${roles[0].channelId}/${messageId}) in ${channelMention}\n`;
        
        for (const roleData of roles) {
          description += `${roleData.emoji} **${roleData.label}** → **${roleData.role.name}**\n`;
        }
        description += '\n';
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Dropdown Roles')
        .setDescription(description)
        .setFooter({ text: `${validDropRoles.length}/200 dropdown roles` });

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Remove all dropdown roles from the server',
        usage: '{guildprefix}droprole reset',
        aliases: ['clear'],
        parameters: [],
        example: '{guildprefix}droprole reset'
      };

      const dropRoles = await guildService.getDropRoles(message.guild.id) || [];

      if (dropRoles.length === 0) {
        return embeds.warn(message, 'No dropdown roles found!');
      }

      await createConfirmation(
        message,
        'Are you sure you want to **remove all dropdown roles**?',
        async (interaction) => {
          await guildService.clearAllDropRoles(message.guild.id);
          const successEmbed = embeds.createSuccess(message, 'Removed all dropdown roles');
          await interaction.update({ embeds: [successEmbed], components: [] });
        }
      );

    } else if (args[0] === 'removeall') {
      const subcommandInfo = {
        description: 'Remove all dropdown roles from a specific message',
        usage: '{guildprefix}droprole removeall [message_link]',
        aliases: [],
        parameters: ['message_link'],
        example: '{guildprefix}droprole removeall https://discord.com/channels/.../...'
      };

      const messageLink = args[1];

      if (!messageLink) {
        return runHelpCommand(message, 'droprole');
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

      // Get current dropdown roles for this message
      const dropRoles = await guildService.getDropRoles(message.guild.id) || [];
      const messageDropRoles = dropRoles.filter(dr => dr.messageId === messageId);

      if (messageDropRoles.length === 0) {
        return embeds.deny(message, 'No dropdown roles found for this message!');
      }

      await createConfirmation(
        message,
        `Are you sure you want to **remove all ${messageDropRoles.length} dropdown roles** from this message?`,
        async (interaction) => {
          // Remove all dropdown roles for this message
          for (const dr of messageDropRoles) {
            await guildService.removeDropRole(message.guild.id, messageId, dr.roleId);
          }

          // Try to remove dropdown from message
          try {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
              const targetMessage = await channel.messages.fetch(messageId);
              
              // Remove select menus, keep buttons
              let components = targetMessage.components || [];
              components = components.filter(row => 
                row.components[0] && row.components[0].type !== 3 // Keep non-StringSelect components
              );

              await targetMessage.edit({ components: components });
            }
          } catch (error) {
            // Ignore errors when updating message
          }

          const successEmbed = embeds.createSuccess(message, `Removed all dropdown roles from the message`);
          await interaction.update({ embeds: [successEmbed], components: [] });
        }
      );

    } else {
      return runHelpCommand(message, 'droprole');
    }
  }
}