const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { colors } = require('../../../config/setup')
const { ensureGuildData } = require('../../../database')
const { embeds } = require('../../../core/embeds')
const { runHelpCommand } = require('../../../utils/commandProcessor')
const logger = require('../../../utils/logger');

module.exports = {
  name: "copyembed",
  aliases: ['copy'],
  description: 'copy an embed custom syntax code',
  syntax: 'copyembed (message)',
  example: 'copyembed 12345678...',
  permission: "manage_messages",
  run: async(client, message, args) => {

    await ensureGuildData(message.guild.id);

    try {
      if (!args[0]) {
        return runHelpCommand(message, 'copyembed');
      }

      const input = args[0];
      let messageId, channelId, guildId;

      // Parse message link or message ID
      const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
      const linkMatch = input.match(messageLinkRegex);

      if (linkMatch) {
        // Message link format
        guildId = linkMatch[1];
        channelId = linkMatch[2];
        messageId = linkMatch[3];

        // Check if it's from the current guild
        if (guildId !== message.guild.id) {
          return embeds.warn(message, 'I can only copy embeds from messages within this server');
        }
      } else {
        // Assume it's a message ID
        messageId = input;
      }

      let copyembed;
      let targetChannel;

      try {
        if (channelId) {
          // Try to get the specific channel from the link
          targetChannel = message.guild.channels.cache.get(channelId);
          if (!targetChannel) {
            return embeds.warn(message, `I was unable to find a channel with the ID: ${channelId}`);
          }

          if (!targetChannel.permissionsFor(client.user).has(PermissionFlagsBits.ViewChannel)) {
            return embeds.warn(message, 'I don\'t have permission to view that channel');
          }

          copyembed = await targetChannel.messages.fetch(messageId);
        } else {
          // Try current channel first
          try {
            copyembed = await message.channel.messages.fetch(messageId);
          } catch (error) {
            // Search all channels in the guild
            let found = false;

            for (const channel of message.guild.channels.cache.values()) {
              if (channel.isTextBased() && channel.permissionsFor(client.user).has(PermissionFlagsBits.ViewChannel)) {
                try {
                  copyembed = await channel.messages.fetch(messageId);
                  found = true;
                  break;
                } catch (err) {
                  continue;
                }
              }
            }

            if (!found) {
              return embeds.warn(message, `I was unable to find a message with the ID: ${messageId}`);
            }
          }
        }
      } catch (error) {
        if (error.code === 10008) {
          return embeds.warn(message, `I was unable to find a message with the ID: ${messageId}`);
        } else {
          throw error;
        }
      }

      if (!copyembed) {
        return embeds.warn(message, 'Message not found');
      }

      // Check if message uses Components V2 (containers)
      const isComponentsV2 = copyembed.flags?.has(MessageFlags.IsComponentsV2);

      if (isComponentsV2) {
        // Handle Components V2 (containers)
        if (!copyembed.components || copyembed.components.length === 0) {
          return embeds.warn(message, 'Message does not contain any display components');
        }

        const customSyntax = toContainerSyntax(copyembed.components);

        const copiedembed = new EmbedBuilder()
          .setColor(colors.success)
          .setDescription(`**Custom Container Syntax:**\n\`\`\`\n${customSyntax}\`\`\``)
          .setFooter({ text: `Successfully copied the container code` })

        return message.channel.send({ embeds: [copiedembed] });
      } else {
        // Handle old embeds
        if (!copyembed.embeds || copyembed.embeds.length === 0) {
          return embeds.warn(message, 'Message does not contain any embeds');
        }

        const customSyntax = toCustomSyntax(copyembed.content, copyembed.embeds[0], copyembed.components)

        const copiedembed = new EmbedBuilder()
          .setColor(colors.success)
          .setDescription(`**Custom Syntax:**\n\`\`\`\n${customSyntax}\`\`\``)
          .setFooter({ text: `Successfully copied the embed code` })

        return message.channel.send({ embeds: [copiedembed] });
      }

    } catch (error) {
      throw error;
    }



    function toContainerSyntax(components) {
      let parts = [];

      // Start with {container} or {v2} prefix
      parts.push('{container}');

      for (const component of components) {
        // Handle TextDisplayBuilder (standalone content)
        if (component.type === 10) { // TEXT_DISPLAY
          if (component.content) {
            parts.push(`{text: ${component.content}}`);
          }
          continue;
        }

        // Handle ContainerBuilder
        if (component.type === 17) { // CONTAINER
          // Add accent color if present
          if (component.accent_color !== undefined && component.accent_color !== null) {
            const hexColor = '#' + component.accent_color.toString(16).padStart(6, '0');
            parts.push(`{color: ${hexColor}}`);
          }

          // Process container components
          if (component.components && component.components.length > 0) {
            for (const innerComponent of component.components) {
              // Text Display
              if (innerComponent.type === 10) {
                if (innerComponent.content) {
                  parts.push(`{text: ${innerComponent.content}}`);
                }
              }
              // Section
              else if (innerComponent.type === 9) {
                let sectionText = '';
                let thumbnailUrl = null;

                // Extract text from section
                if (innerComponent.components) {
                  const textDisplays = innerComponent.components.filter(c => c.type === 10);
                  sectionText = textDisplays.map(t => t.content).filter(c => c).join('\n');
                }

                // Extract thumbnail from accessory
                if (innerComponent.accessory) {
                  if (innerComponent.accessory.type === 11) { // THUMBNAIL
                    // URL is in media.url
                    thumbnailUrl = innerComponent.accessory.media?.url || innerComponent.accessory.url;
                  }
                }

                // Build section syntax
                if (sectionText) {
                  if (thumbnailUrl) {
                    parts.push(`{section: ${sectionText}&&${thumbnailUrl}}`);
                  } else {
                    parts.push(`{section: ${sectionText}}`);
                  }
                }
              }
              // Separator
              else if (innerComponent.type === 14) {
                parts.push(`{separator}`);
              }
              // Media Gallery
              else if (innerComponent.type === 12) {
                if (innerComponent.items && innerComponent.items.length > 0) {
                  // Extract URLs from media.url
                  const urls = innerComponent.items.map(item => item.media?.url || item.url).filter(url => url);
                  if (urls.length > 0) {
                    // If only 1 image, treat as single image, otherwise as gallery
                    if (urls.length === 1) {
                      parts.push(`{image: ${urls[0]}}`);
                    } else {
                      parts.push(`{gallery: ${urls.join('&&')}}`);
                    }
                  }
                }
              }
              // Action Row (buttons)
              else if (innerComponent.type === 1) {
                if (innerComponent.components) {
                  for (const button of innerComponent.components) {
                    if (button.type === 2) { // BUTTON
                      let buttonParts = [];

                      if (button.style === 5) { // Link button
                        buttonParts.push(button.url || '');
                        buttonParts.push(button.label || '');
                        
                        if (button.emoji) {
                          if (button.emoji.id) {
                            buttonParts.push(`<${button.emoji.animated ? 'a' : ''}:${button.emoji.name}:${button.emoji.id}>`);
                          } else {
                            buttonParts.push(button.emoji.name || '');
                          }
                        } else {
                          buttonParts.push('');
                        }

                        if (button.disabled) {
                          buttonParts.push('disabled');
                        }
                      } else {
                        // Colored button
                        let buttonStyle = 'secondary';
                        switch (button.style) {
                          case 1: buttonStyle = 'primary'; break;
                          case 2: buttonStyle = 'secondary'; break;
                          case 3: buttonStyle = 'success'; break;
                          case 4: buttonStyle = 'danger'; break;
                        }

                        buttonParts.push(buttonStyle);
                        buttonParts.push(button.label || '');
                        
                        if (button.emoji) {
                          if (button.emoji.id) {
                            buttonParts.push(`<${button.emoji.animated ? 'a' : ''}:${button.emoji.name}:${button.emoji.id}>`);
                          } else {
                            buttonParts.push(button.emoji.name || '');
                          }
                        } else {
                          buttonParts.push('');
                        }

                        if (button.disabled) {
                          buttonParts.push('disabled');
                        }
                      }

                      parts.push(`{button: ${buttonParts.join('&&')}}`);
                    }
                  }
                }
              }
            }
          }
        }
      }

      return parts.join('$v');
    }

    function toCustomSyntax(content, messageEmbed, components = []) {
      let parts = [];

      // Start with {embed} prefix to indicate embed mode
      parts.push('{embed}');

      // Proper order: message, author, title, description, thumbnail, image, footer, buttons

      // 1. Add content as message if it exists
      if (content) {
        parts.push(`{message: ${content}}`);
      }

      // 2. Add author (simplified format: name&&icon)
      if (messageEmbed.author) {
        let authorParts = [];
        if (messageEmbed.author.name) authorParts.push(messageEmbed.author.name);
        if (messageEmbed.author.iconURL) authorParts.push(messageEmbed.author.iconURL);
        if (authorParts.length > 0) {
          parts.push(`{author: ${authorParts.join('&&')}}`);
        }
      }

      // 3. Add title
      if (messageEmbed.title) {
        parts.push(`{title: ${messageEmbed.title}}`);
      }

      // 4. Add description
      if (messageEmbed.description) {
        parts.push(`{description: ${messageEmbed.description}}`);
      }

      // 5. Add URL (if exists)
      if (messageEmbed.url) {
        parts.push(`{url: ${messageEmbed.url}}`);
      }

      // 6. Add color (if exists)
      if (messageEmbed.color) {
        parts.push(`{color: #${messageEmbed.color.toString(16).padStart(6, '0')}}`);
      }

      // 7. Add thumbnail
      if (messageEmbed.thumbnail && messageEmbed.thumbnail.url) {
        parts.push(`{thumbnail: ${messageEmbed.thumbnail.url}}`);
      }

      // 8. Add image
      if (messageEmbed.image && messageEmbed.image.url) {
        parts.push(`{image: ${messageEmbed.image.url}}`);
      }

      // 9. Add fields (simplified format: name&&value&&inline)
      if (messageEmbed.fields && messageEmbed.fields.length > 0) {
        messageEmbed.fields.forEach(field => {
          let fieldParts = [field.name, field.value];
          if (field.inline) fieldParts.push('true');
          parts.push(`{field: ${fieldParts.join('&&')}}`);
        });
      }

      // 10. Add timestamp (if exists)
      if (messageEmbed.timestamp) {
        parts.push(`{timestamp}`);
      }

      // 11. Add footer (simplified format: text&&icon)
      if (messageEmbed.footer) {
        let footerParts = [];
        if (messageEmbed.footer.text) footerParts.push(messageEmbed.footer.text);
        if (messageEmbed.footer.iconURL) footerParts.push(messageEmbed.footer.iconURL);
        if (footerParts.length > 0) {
          parts.push(`{footer: ${footerParts.join('&&')}}`);
        }
      }

      // 12. Add buttons (if any)
      if (components && components.length > 0) {
        components.forEach(actionRow => {
          if (actionRow.components) {
            actionRow.components.forEach(button => {
              if (button.type === 2) { // Button component
                let buttonParts = [];

                // Determine button type
                if (button.style === 5) { // Link button
                  buttonParts.push(button.url || '');
                  buttonParts.push(button.label || '');
                  if (button.emoji) {
                    if (button.emoji.id) {
                      // Custom emoji
                      buttonParts.push(`<${button.emoji.animated ? 'a' : ''}:${button.emoji.name}:${button.emoji.id}>`);
                    } else {
                      // Unicode emoji
                      buttonParts.push(button.emoji.name);
                    }
                  }
                } else {
                  // Colored button
                  let buttonType = 'gray'; // default
                  switch (button.style) {
                    case 1: buttonType = 'blue'; break;
                    case 2: buttonType = 'gray'; break;
                    case 3: buttonType = 'green'; break;
                    case 4: buttonType = 'red'; break;
                  }

                  buttonParts.push(buttonType);
                  buttonParts.push(button.label || '');
                  if (button.emoji) {
                    if (button.emoji.id) {
                      // Custom emoji
                      buttonParts.push(`<${button.emoji.animated ? 'a' : ''}:${button.emoji.name}:${button.emoji.id}>`);
                    } else {
                      // Unicode emoji
                      buttonParts.push(button.emoji.name);
                    }
                  }
                }

                parts.push(`{button: ${buttonParts.join('&&')}}`);
              }
            });
          }
        });
      }

      return parts.join('$v');
    }
  }
}
