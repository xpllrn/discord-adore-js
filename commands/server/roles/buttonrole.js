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
  aliases: [],
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
      const roleResult = findRole(message.guild, roleName);

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

      // Check if this is a v2 message (has MessageFlags.IsComponentsV2)
      const isV2Message = targetMessage.flags?.has('IsComponentsV2');

      // Update message with new button
      try {
        if (isV2Message) {
          // V2 message - need to add button to container's action rows
          const { 
            ContainerBuilder, 
            TextDisplayBuilder,
            SectionBuilder,
            SeparatorBuilder,
            MediaGalleryBuilder,
            ActionRowBuilder: V2ActionRowBuilder,
            ButtonBuilder: V2ButtonBuilder,
            MessageFlags 
          } = require('discord.js');
          
          let components = [...targetMessage.components];
          
          // Find the container - it's usually the last component
          let containerIndex = -1;
          for (let i = components.length - 1; i >= 0; i--) {
            // Check if this looks like a container (has nested components)
            if (components[i].components && Array.isArray(components[i].components)) {
              containerIndex = i;
              break;
            }
          }
          
          if (containerIndex === -1) {
            return embeds.deny(message, 'Could not find container in v2 message! Make sure this is a v2 message with a container.');
          }

          // Get the existing container data
          const existingContainer = components[containerIndex];
          

          
          // Create a new container and copy all existing components
          const newContainer = new ContainerBuilder();
          
          // Copy accent color if it exists
          if (existingContainer.data?.accent_color) {
            newContainer.setAccentColor(existingContainer.data.accent_color);
          }
          
          // First pass: Collect all existing buttons
          const allExistingButtons = [];
          
          console.log('Starting button collection from', existingContainer.components?.length, 'components');
          
          if (existingContainer.components && Array.isArray(existingContainer.components)) {
            for (const comp of existingContainer.components) {
              console.log(`Checking component type ${comp.type}`);
              if (comp.type === 1) {
                // Action row with buttons - collect them
                console.log('Found action row with', comp.components?.length, 'components');
                if (comp.components && Array.isArray(comp.components)) {
                  const existingButtons = comp.components
                    .filter(btnData => btnData && btnData.type === 2) // Type 2 = Button
                    .map(btnData => {
                      console.log('Reconstructing button from data:', JSON.stringify(btnData, null, 2));
                      
                      // Access custom_id using bracket notation since it has underscore
                      const customId = btnData['custom_id'] || btnData.customId;
                      const url = btnData.url;
                      
                      console.log('Extracted customId:', customId);
                      console.log('Extracted url:', url);
                      
                      const btn = new V2ButtonBuilder();
                      
                      // Set custom_id or url FIRST (one is required)
                      if (customId) {
                        console.log('Setting customId:', customId);
                        btn.setCustomId(customId);
                      } else if (url) {
                        console.log('Setting url:', url);
                        btn.setURL(url);
                      }
                      
                      // Set style (required)
                      if (btnData.style) {
                        btn.setStyle(btnData.style);
                      }
                      
                      // Set label
                      if (btnData.label) {
                        btn.setLabel(btnData.label);
                      }
                      
                      // Set emoji if present
                      if (btnData.emoji) {
                        const emojiValue = typeof btnData.emoji === 'object' ? btnData.emoji.name : btnData.emoji;
                        if (emojiValue) btn.setEmoji(emojiValue);
                      }
                      
                      // Set disabled state
                      if (btnData.disabled) btn.setDisabled(btnData.disabled);
                      
                      console.log('Final button customId:', btn.data?.custom_id);
                      return btn;
                    });
                  allExistingButtons.push(...existingButtons);
                }
              }
            }
          }

          
          // Second pass: Copy all non-button components
          if (existingContainer.components && Array.isArray(existingContainer.components)) {
            for (const comp of existingContainer.components) {
              // Skip action rows (buttons) - we'll add them all at the end
              if (comp.type === 1) {
                continue;
              }
              
              // Copy other component types
              // Component types based on actual Discord API:
              // Type 1 = ActionRow
              // Type 9 = Section
              // Type 10 = TextDisplay
              // Type 11 = Thumbnail (when used as accessory)
              // Type 12 = MediaGallery
              // Type 14 = Separator
              try {
                if (comp.type === 14) { // Separator
                  newContainer.addSeparatorComponents((separator) => {
                    if (comp.divider !== undefined) separator.setDivider(comp.divider);
                    if (comp.spacing !== undefined) separator.setSpacing(comp.spacing);
                    return separator;
                  });
                } else if (comp.type === 10) { // Text display
                  const content = comp.content || '';
                  newContainer.addTextDisplayComponents((text) => text.setContent(content));
                } else if (comp.type === 9) { // Section
                  newContainer.addSectionComponents((section) => {
                    // Copy section text displays
                    if (comp.components && Array.isArray(comp.components)) {
                      const textDisplays = comp.components
                        .filter(c => c.type === 10)
                        .map(c => (text) => text.setContent(c.content || ''));
                      if (textDisplays.length > 0) {
                        section.addTextDisplayComponents(...textDisplays);
                      }
                    }
                    // Copy accessory (thumbnail or button)
                    if (comp.accessory) {
                      if (comp.accessory.type === 11) { // Thumbnail
                        // URL is in media.url for fetched messages
                        const thumbnailUrl = comp.accessory.media?.url || comp.accessory.url;
                        if (thumbnailUrl) {
                          section.setThumbnailAccessory((thumbnail) => {
                            thumbnail.setURL(thumbnailUrl);
                            if (comp.accessory.description) thumbnail.setDescription(comp.accessory.description);
                            if (comp.accessory.spoiler !== undefined) thumbnail.setSpoiler(comp.accessory.spoiler);
                            return thumbnail;
                          });
                        }
                      } else if (comp.accessory.type === 2) { // Button accessory
                        section.setButtonAccessory((btn) => {
                          if (comp.accessory.custom_id) btn.setCustomId(comp.accessory.custom_id);
                          if (comp.accessory.label) btn.setLabel(comp.accessory.label);
                          if (comp.accessory.style) btn.setStyle(comp.accessory.style);
                          if (comp.accessory.emoji) btn.setEmoji(comp.accessory.emoji);
                          if (comp.accessory.url) btn.setURL(comp.accessory.url);
                          if (comp.accessory.disabled) btn.setDisabled(comp.accessory.disabled);
                          return btn;
                        });
                      }
                    }
                    return section;
                  });
                } else if (comp.type === 12) { // Media gallery
                  newContainer.addMediaGalleryComponents((gallery) => {
                    if (comp.items && Array.isArray(comp.items)) {
                      const items = comp.items.map(item => (mediaItem) => {
                        if (item.url) mediaItem.setURL(item.url);
                        if (item.description) mediaItem.setDescription(item.description);
                        if (item.spoiler !== undefined) mediaItem.setSpoiler(item.spoiler);
                        return mediaItem;
                      });
                      gallery.addItems(...items);
                    }
                    return gallery;
                  });
                }
              } catch (err) {
                console.error('Error copying component:', err);
              }
            }
          }

          // Add the new button to the collection
          allExistingButtons.push(button);
          
          console.log(`Total buttons: ${allExistingButtons.length}`);
          allExistingButtons.forEach((btn, idx) => {
            console.log(`Button ${idx}: customId=${btn.data?.custom_id}, label=${btn.data?.label}`);
          });
          
          // Add a separator before the buttons if there were existing buttons
          if (allExistingButtons.length > 1) {
            newContainer.addSeparatorComponents((separator) => separator);
          }

          // Add all buttons in rows of 5 (Discord limit)
          for (let i = 0; i < allExistingButtons.length; i += 5) {
            const buttonSlice = allExistingButtons.slice(i, i + 5);
            console.log(`Adding row ${Math.floor(i/5)} with ${buttonSlice.length} buttons`);
            newContainer.addActionRowComponents((actionRow) =>
              actionRow.setComponents(...buttonSlice)
            );
          }

          // Replace the container in the components array
          components[containerIndex] = newContainer;

          // Edit the message with the updated container
          await targetMessage.edit({ 
            components: components,
            flags: MessageFlags.IsComponentsV2
          });
        } else {
          // Regular message - use standard action rows
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

          await targetMessage.edit({ components: components });
        }
      } catch (error) {
        console.error('Button add error:', error);
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
      const roleResult = findRole(message.guild, roleName);

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
          const isV2Message = targetMessage.flags?.has('IsComponentsV2');
          
          if (isV2Message) {
            // V2 message - removing buttons from containers is complex
            // For now, we'll just skip the message edit and only update the database
            // The button will remain visible but won't function after database removal
            // TODO: Implement proper container reconstruction to remove specific buttons
            console.log('Note: Button removed from database but still visible in v2 message');
          } else {
            // Regular message
            let components = targetMessage.components || [];
            components = components.map(row => {
              const newComponents = row.components.filter(component => 
                component.customId !== buttonRole.buttonId
              );
              return ActionRowBuilder.from(row).setComponents(newComponents);
            }).filter(row => row.components.length > 0);

            await targetMessage.edit({ components: components });
          }
        }
      } catch (error) {
        // Continue even if message update fails
        console.error('Button remove error:', error);
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
        return embeds.warn(message, 'No **button roles** were found!');
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
          // Group button roles by message
          const messageGroups = {};
          for (const br of buttonRoles) {
            if (!messageGroups[br.messageId]) {
              messageGroups[br.messageId] = {
                channelId: br.channelId,
                buttonIds: []
              };
            }
            messageGroups[br.messageId].buttonIds.push(br.buttonId);
          }

          // Remove buttons from each message
          let removedCount = 0;
          let processedCount = 0;
          for (const [messageId, data] of Object.entries(messageGroups)) {
            processedCount++;
            try {
              const channel = message.guild.channels.cache.get(data.channelId);
              if (!channel) {
                console.log(`Channel ${data.channelId} not found for message ${messageId}`);
                continue;
              }
              
              const targetMessage = await channel.messages.fetch(messageId).catch(() => null);
              if (!targetMessage) {
                console.log(`Message ${messageId} not found in channel ${data.channelId}`);
                continue;
              }
              
              const isV2Message = targetMessage.flags?.has('IsComponentsV2');
              
              if (isV2Message) {
                // V2 message - rebuild container without button action rows
                const { 
                      ContainerBuilder, 
                      TextDisplayBuilder,
                      SectionBuilder,
                      SeparatorBuilder,
                      MediaGalleryBuilder,
                      MessageFlags 
                    } = require('discord.js');
                    
                    let components = [...targetMessage.components];
                    let containerIndex = -1;
                    for (let i = components.length - 1; i >= 0; i--) {
                      if (components[i].components && Array.isArray(components[i].components)) {
                        containerIndex = i;
                        break;
                      }
                    }
                    
                    if (containerIndex !== -1) {
                      const existingContainer = components[containerIndex];
                      const newContainer = new ContainerBuilder();
                      
                      // Copy accent color
                      if (existingContainer.data?.accent_color) {
                        newContainer.setAccentColor(existingContainer.data.accent_color);
                      }
                      
                      // Copy all non-button components
                      if (existingContainer.components && Array.isArray(existingContainer.components)) {
                        for (const comp of existingContainer.components) {
                          // Skip action rows (buttons)
                          if (comp.type === 1) {
                            // Check if this action row contains buttonrole buttons
                            const hasButtonRole = comp.components?.some(btn => 
                              data.buttonIds.includes(btn.custom_id)
                            );
                            if (hasButtonRole) {
                              continue; // Skip this action row
                            }
                          }
                          
                          // Copy other components
                          try {
                            if (comp.type === 14) { // Separator
                              newContainer.addSeparatorComponents((separator) => {
                                if (comp.divider !== undefined) separator.setDivider(comp.divider);
                                if (comp.spacing !== undefined) separator.setSpacing(comp.spacing);
                                return separator;
                              });
                            } else if (comp.type === 10) { // Text display
                              const content = comp.content || '';
                              newContainer.addTextDisplayComponents((text) => text.setContent(content));
                            } else if (comp.type === 9) { // Section
                              newContainer.addSectionComponents((section) => {
                                if (comp.components && Array.isArray(comp.components)) {
                                  const textDisplays = comp.components
                                    .filter(c => c.type === 10)
                                    .map(c => (text) => text.setContent(c.content || ''));
                                  if (textDisplays.length > 0) {
                                    section.addTextDisplayComponents(...textDisplays);
                                  }
                                }
                                if (comp.accessory && comp.accessory.type === 11) {
                                  const thumbnailUrl = comp.accessory.media?.url || comp.accessory.url;
                                  if (thumbnailUrl) {
                                    section.setThumbnailAccessory((thumbnail) => {
                                      thumbnail.setURL(thumbnailUrl);
                                      if (comp.accessory.description) thumbnail.setDescription(comp.accessory.description);
                                      if (comp.accessory.spoiler !== undefined) thumbnail.setSpoiler(comp.accessory.spoiler);
                                      return thumbnail;
                                    });
                                  }
                                }
                                return section;
                              });
                            } else if (comp.type === 12) { // Media gallery
                              newContainer.addMediaGalleryComponents((gallery) => {
                                if (comp.items && Array.isArray(comp.items)) {
                                  const items = comp.items.map(item => (mediaItem) => {
                                    if (item.url) mediaItem.setURL(item.url);
                                    if (item.description) mediaItem.setDescription(item.description);
                                    if (item.spoiler !== undefined) mediaItem.setSpoiler(item.spoiler);
                                    return mediaItem;
                                  });
                                  gallery.addItems(...items);
                                }
                                return gallery;
                              });
                            }
                          } catch (err) {
                            console.error('Error copying component:', err);
                          }
                        }
                      }
                      
                      components[containerIndex] = newContainer;
                      await targetMessage.edit({ 
                        components: components,
                        flags: MessageFlags.IsComponentsV2
                      });
                      console.log(`Removed buttons from v2 message ${messageId}`);
                      removedCount++;
                    }
                  } else {
                    // Regular message - remove button action rows
                    let components = targetMessage.components || [];
                    components = components.map(row => {
                      const newComponents = row.components.filter(component => 
                        !data.buttonIds.includes(component.customId)
                      );
                      return ActionRowBuilder.from(row).setComponents(newComponents);
                    }).filter(row => row.components.length > 0);

                    await targetMessage.edit({ components: components });
                    console.log(`Removed buttons from regular message ${messageId}`);
                    removedCount++;
                  }
            } catch (error) {
              console.error('Error removing buttons from message:', messageId, error);
            }
          }
          
          console.log(`Processed ${processedCount} messages, successfully removed buttons from ${removedCount}`);

          // Clear from database
          await guildService.clearAllButtonRoles(message.guild.id);
          
          const successEmbed = embeds.createSuccess(message, `Removed all button roles from ${removedCount} message(s)`);
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
              const isV2Message = targetMessage.flags?.has('IsComponentsV2');
              
              if (isV2Message) {
                // V2 message - removing all buttons from containers
                // For now, skip message edit - buttons removed from database only
                console.log('Note: Buttons removed from database but still visible in v2 message');
              } else {
                // Regular message - just clear components
                await targetMessage.edit({ components: [] });
              }
            }
          } catch (error) {
            // Ignore errors when updating message
            console.error('Remove all buttons error:', error);
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