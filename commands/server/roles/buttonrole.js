const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { checkUserRoleHierarchy, checkBotRoleHierarchy } = require('../../../utils/permissions');
const { ensureGuildData } = require('../../../database');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');

module.exports = {
  name: "buttonrole",
  aliases: ['br'],
  description: `Manage button roles`,
  syntax: 'buttonrole [subcommand] (parameters)',
  example: 'buttonrole add https://discord.com/channels/.../... @Member primary 🌟 "Get Member Role"',
  permission: 'manage_roles',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Add a button role to a message',
        syntax: '{guildprefix}buttonrole add [message_link] [role] [style] <emoji> <label>',
        aliases: [],
        parameters: ['message_link', 'role', 'style', 'emoji', 'label'],
        example: '{guildprefix}buttonrole add https://discord.com/channels/.../... @Member primary 🌟 "Get Member Role"'
      };

      const messageLink = args[1];
      const roleName = args[2];
      const style = args[3];
      const emoji = args[4];
      const label = args.slice(5).join(' ');

      if (!messageLink || !roleName || !style) {
        return false;
      }

      // At least one of emoji or label must be provided
      if (!emoji && !label) {
        return embeds.deny(message, 'You must provide at least an emoji or a label for the button!');
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
      let deniedPerm = null;
      if (role.permissions.has(PermissionFlagsBits.Administrator)) deniedPerm = '`administrator`';
      else if (role.permissions.has(PermissionFlagsBits.ManageGuild)) deniedPerm = '`manage server`';
      else if (role.permissions.has(PermissionFlagsBits.ManageRoles)) deniedPerm = '`manage roles`';
      else if (role.permissions.has(PermissionFlagsBits.ManageChannels)) deniedPerm = '`manage channels`';
      else if (role.permissions.has(PermissionFlagsBits.BanMembers)) deniedPerm = '`ban members`';
      else if (role.permissions.has(PermissionFlagsBits.KickMembers)) deniedPerm = '`kick members`';

      if (deniedPerm) {
        return embeds.deny(message, `You can't add a button role with any **moderation related** permissions. Permissions denied: ${deniedPerm}`);
      }

      // Hierarchy checks
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Validate button style and map color names
      const styleMap = {
        'primary': ButtonStyle.Primary,
        'blue': ButtonStyle.Primary,
        'secondary': ButtonStyle.Secondary,
        'grey': ButtonStyle.Secondary,
        'gray': ButtonStyle.Secondary,
        'success': ButtonStyle.Success,
        'green': ButtonStyle.Success,
        'danger': ButtonStyle.Danger,
        'red': ButtonStyle.Danger
      };

      const normalizedStyle = style.toLowerCase();
      if (!styleMap[normalizedStyle]) {
        return embeds.deny(message, 'Invalid button style! Use: `primary/blue`, `secondary/grey`, `success/green`, or `danger/red`');
      }

      const buttonStyle = styleMap[normalizedStyle];

      // Get current button roles
      const buttonRoles = await guildService.getButtonRoles(message.guild.id) || [];

      // Check if this message already has 5 buttons (Discord limit)
      const messageButtonRoles = buttonRoles.filter(br => br.messageId === messageId);
      if (messageButtonRoles.length >= 5) {
        return embeds.deny(message, 'This message already has the maximum of **5 buttons**!');
      }

      // Check if this role is already assigned to a button on this message
      const existingButtonRole = messageButtonRoles.find(br => br.roleId === role.id);
      if (existingButtonRole) {
        return embeds.deny(message, `**${role.name}** already has a button on this message!`);
      }

      // Check global limit (max 100 button roles per server)
      if (buttonRoles.length >= 100) {
        return embeds.deny(message, 'You have reached the maximum limit of **100 button roles** per server!');
      }

      // Generate unique button ID
      const buttonId = `buttonrole_${messageId}_${role.id}`;

      // Create button
      const button = new ButtonBuilder()
        .setCustomId(buttonId)
        .setStyle(buttonStyle);

      // Add label if provided
      if (label) {
        button.setLabel(label);
      }

      // Add emoji if provided
      if (emoji) {
        try {
          button.setEmoji(emoji);
        } catch (error) {
          return embeds.deny(message, 'Invalid emoji! Make sure the emoji is valid and accessible to the bot.');
        }
      }

      // Get existing components or create new ones
      let components = targetMessage.components || [];
      
      // Find existing action row or create new one
      let actionRow;
      if (components.length > 0 && components[0].components.length < 5) {
        actionRow = ActionRowBuilder.from(components[0]);
      } else if (components.length < 5) {
        actionRow = new ActionRowBuilder();
        components.push(actionRow);
      } else {
        return embeds.deny(message, 'This message already has the maximum number of button rows!');
      }

      actionRow.addComponents(button);

      // Update message with new button
      try {
        await targetMessage.edit({ components: components });
      } catch (error) {
        return embeds.deny(message, 'Failed to add button to message! Make sure the emoji is valid and the bot has permissions.');
      }

      // Save to database
      await guildService.addButtonRole(message.guild.id, {
        messageId: messageId,
        channelId: channelId,
        roleId: role.id,
        buttonId: buttonId,
        label: label || null,
        style: normalizedStyle,
        emoji: emoji || null
      });

      const displayEmoji = emoji || '';
      const displayLabel = label ? `\`${label}\`` : '';
      const displayText = displayEmoji && displayLabel ? `${displayEmoji} ${displayLabel}` : (displayEmoji || displayLabel);
      return embeds.success(message, `Added ${displayText} to [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}) with ${role} assigned`);

    } else if (args[0] === 'remove') {
      const subcommandInfo = {
        description: 'Remove a button role from a message',
        syntax: '{guildprefix}buttonrole remove [message_link] [role]',
        aliases: [],
        parameters: ['message_link', 'role'],
        example: '{guildprefix}buttonrole remove https://discord.com/channels/.../... @Member'
      };

      const messageLink = args[1];
      const roleName = args[2];

      if (!messageLink || !roleName) {
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

      // Find role
      const roleResult = message.mentions.roles.first() ?
        { found: true, role: message.mentions.roles.first() } :
        findRole(message.guild, roleName);

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Get current button roles
      const buttonRoles = await guildService.getButtonRoles(message.guild.id) || [];

      // Find the button role
      const buttonRole = buttonRoles.find(br => 
        br.messageId === messageId && br.roleId === role.id
      );

      if (!buttonRole) {
        return embeds.deny(message, 'No button role found for this message and role!');
      }

      // Get message and update components
      try {
        const channel = message.guild.channels.cache.get(channelId);
        if (channel) {
          const targetMessage = await channel.messages.fetch(messageId);
          
          // Remove the button from components
          let components = targetMessage.components || [];
          components = components.map(row => {
            const newComponents = row.components.filter(component => 
              component.customId !== buttonRole.buttonId
            );
            return ActionRowBuilder.from(row).setComponents(newComponents);
          }).filter(row => row.components.length > 0);

          await targetMessage.edit({ components: components });
        }
      } catch (error) {
        // Continue even if message update fails
      }

      // Remove from database
      await guildService.removeButtonRole(message.guild.id, messageId, role.id);

      const displayEmoji = buttonRole.emoji || '';
      const displayLabel = buttonRole.label ? `\`${buttonRole.label}\`` : '';
      const displayText = displayEmoji && displayLabel ? `${displayEmoji} ${displayLabel}` : (displayEmoji || displayLabel || 'button');
      return embeds.success(message, `Removed ${displayText} from [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}) with ${role} unassigned`);

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all button roles in the server',
        syntax: '{guildprefix}buttonrole list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}buttonrole list'
      };

      const buttonRoles = await guildService.getButtonRoles(message.guild.id) || [];

      if (buttonRoles.length === 0) {
        return embeds.warn(message, 'No button roles found!');
      }

      // Clean up invalid roles and group by message
      const validButtonRoles = [];
      const messageGroups = {};

      for (const br of buttonRoles) {
        const role = message.guild.roles.cache.get(br.roleId);
        if (role) {
          validButtonRoles.push(br);
          if (!messageGroups[br.messageId]) {
            messageGroups[br.messageId] = [];
          }
          messageGroups[br.messageId].push({
            label: br.label,
            role: role,
            channelId: br.channelId,
            style: br.style,
            emoji: br.emoji
          });
        } else {
          // Remove invalid role from database
          await guildService.removeButtonRole(message.guild.id, br.messageId, br.roleId);
        }
      }

      if (validButtonRoles.length === 0) {
        return embeds.warn(message, 'No valid button roles found!');
      }

      let description = '';
      let count = 0;

      for (const [messageId, roles] of Object.entries(messageGroups)) {
        for (const roleData of roles) {
          count++;
          description += `\`${count}\` [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${roleData.channelId}/${messageId}) - ${roleData.role}\n`;
        }
      }

      const totalPages = 1;
      const currentPage = 1;
      const entryText = validButtonRoles.length === 1 ? 'entry' : 'entries';

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setAuthor({ name: 're.voro', iconURL: 'https://cdn.discordapp.com/embed/avatars/5.png' })
        .setTitle('Button Roles')
        .setDescription(description.trim())
        .setFooter({ text: `Page ${currentPage}/${totalPages} (${validButtonRoles.length} ${entryText})` });

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Remove all button roles from the server',
        syntax: '{guildprefix}buttonrole reset',
        aliases: ['clear'],
        parameters: [],
        example: '{guildprefix}buttonrole reset'
      };

      const buttonRoles = await guildService.getButtonRoles(message.guild.id) || [];

      if (buttonRoles.length === 0) {
        return embeds.warn(message, 'No button roles found!');
      }

      await createConfirmation(
        message,
        'Are you sure you want to **remove all button roles**?',
        async (interaction, sentMessage) => {
          await guildService.clearAllButtonRoles(message.guild.id);
          const successEmbed = embeds.createSuccess(message, 'Removed all button roles');
          await sentMessage.edit({ embeds: [successEmbed], components: [] });
        }
      );

    } else if (args[0] === 'removeall') {
      const subcommandInfo = {
        description: 'Remove all button roles from a specific message',
        syntax: '{guildprefix}buttonrole removeall [message_link]',
        aliases: [],
        parameters: ['message_link'],
        example: '{guildprefix}buttonrole removeall https://discord.com/channels/.../...'
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
        return embeds.deny(message, 'Message must be from this server!');
      }

      // Get current button roles for this message
      const buttonRoles = await guildService.getButtonRoles(message.guild.id) || [];
      const messageButtonRoles = buttonRoles.filter(br => br.messageId === messageId);

      if (messageButtonRoles.length === 0) {
        return embeds.deny(message, 'No button roles found for this message!');
      }

      await createConfirmation(
        message,
        `Are you sure you want to **remove all ${messageButtonRoles.length} button roles** from this message?`,
        async (interaction, sentMessage) => {
          // Remove all button roles for this message
          for (const br of messageButtonRoles) {
            await guildService.removeButtonRole(message.guild.id, messageId, br.roleId);
          }

          // Try to remove buttons from message
          try {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
              const targetMessage = await channel.messages.fetch(messageId);
              await targetMessage.edit({ components: [] });
            }
          } catch (error) {
            // Ignore errors when updating message
          }

          const successEmbed = embeds.createSuccess(message, `Removed all button roles from [\`${messageId}\`](https://discord.com/channels/${message.guild.id}/${channelId}/${messageId})`);
          await sentMessage.edit({ embeds: [successEmbed], components: [] });
        }
      );

    } else {
      return false;
    }
  }
}