const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { checkUserRoleHierarchy, checkBotRoleHierarchy } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');

module.exports = {
  name: "buttonrole",
  aliases: ['br'],
  description: `Manage button roles`,
  permission: 'Manage Roles',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const messageLink = args[1];
      const roleName = args[2];
      const style = args[3];
      const emoji = args[4];
      const label = args.slice(5).join(' ');

      if (!messageLink || !roleName || !style || !emoji || !label) {
        return embeds.deny(message, 'Usage: `buttonrole add <message_link> <role> <style> <emoji> <label>`\nStyles: `primary`, `secondary`, `success`, `danger`');
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
        return embeds.deny(message, `**${role.name}** is an admin/management role and cannot be used for button roles!`);
      }

      // Hierarchy checks
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Validate button style
      const validStyles = ['primary', 'secondary', 'success', 'danger'];
      if (!validStyles.includes(style.toLowerCase())) {
        return embeds.deny(message, 'Invalid button style! Use: `primary`, `secondary`, `success`, or `danger`');
      }

      const buttonStyleMap = {
        'primary': ButtonStyle.Primary,
        'secondary': ButtonStyle.Secondary,
        'success': ButtonStyle.Success,
        'danger': ButtonStyle.Danger
      };

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
        .setLabel(label)
        .setStyle(buttonStyleMap[style.toLowerCase()])
        .setEmoji(emoji);

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
        return embeds.deny(message, 'Failed to add button to message! Make sure the emoji is valid.');
      }

      // Save to database
      await guildService.addButtonRole(message.guild.id, {
        messageId: messageId,
        channelId: channelId,
        roleId: role.id,
        buttonId: buttonId,
        label: label,
        style: style.toLowerCase(),
        emoji: emoji
      });

      return embeds.success(message, `Added button role: **${label}** → **${role.name}**`);

    } else if (args[0] === 'remove') {
      const messageLink = args[1];
      const roleName = args[2];

      if (!messageLink || !roleName) {
        return embeds.deny(message, 'Usage: `buttonrole remove <message_link> <role>`');
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

      return embeds.success(message, `Removed button role: **${buttonRole.label}** → **${role.name}**`);

    } else if (args[0] === 'list') {
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

      for (const [messageId, roles] of Object.entries(messageGroups)) {
        const channel = message.guild.channels.cache.get(roles[0].channelId);
        const channelMention = channel ? `<#${channel.id}>` : 'Unknown Channel';
        
        description += `**Message:** [Jump to Message](https://discord.com/channels/${message.guild.id}/${roles[0].channelId}/${messageId}) in ${channelMention}\n`;
        
        for (const roleData of roles) {
          description += `${roleData.emoji} **${roleData.label}** (${roleData.style}) → **${roleData.role.name}**\n`;
        }
        description += '\n';
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Button Roles')
        .setDescription(description)
        .setFooter({ text: `${validButtonRoles.length}/100 button roles` });

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'reset') {
      const buttonRoles = await guildService.getButtonRoles(message.guild.id) || [];

      if (buttonRoles.length === 0) {
        return embeds.warn(message, 'No button roles found!');
      }

      await createConfirmation(
        message,
        'Are you sure you want to **remove all button roles**?',
        async (interaction) => {
          await guildService.clearAllButtonRoles(message.guild.id);
          const successEmbed = embeds.createSuccess(message, 'Removed all button roles');
          await interaction.update({ embeds: [successEmbed], components: [] });
        }
      );

    } else if (args[0] === 'removeall') {
      const messageLink = args[1];

      if (!messageLink) {
        return embeds.deny(message, 'Usage: `buttonrole removeall <message_link>`');
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
        async (interaction) => {
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

          const successEmbed = embeds.createSuccess(message, `Removed all button roles from the message`);
          await interaction.update({ embeds: [successEmbed], components: [] });
        }
      );

    } else {
      return runHelpCommand(message, 'buttonrole');
    }
  }
}