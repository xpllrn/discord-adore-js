const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
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

      if (!copyembed.embeds || copyembed.embeds.length === 0) {
        return embeds.warn(message, 'Message does not contain any embeds');
      }

      const customSyntax = toCustomSyntax(copyembed.content, copyembed.embeds[0], copyembed.components)

      const copiedembed = new EmbedBuilder()
        .setColor(colors.success)
        .setDescription(`**Custom Syntax:**\n\`\`\`\n${customSyntax}\`\`\``)
        .setFooter({ text: `Successfully copied the embed code` })

      return message.channel.send({ embeds: [copiedembed] })

    } catch (error) {
      throw error;
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

      // 2. Add author
      if (messageEmbed.author) {
        let authorParts = [];
        if (messageEmbed.author.name) authorParts.push(messageEmbed.author.name);
        if (messageEmbed.author.iconURL) authorParts.push(`icon: ${messageEmbed.author.iconURL}`);
        if (messageEmbed.author.url) authorParts.push(`url: ${messageEmbed.author.url}`);
        if (authorParts.length > 0) {
          parts.push(`{author: ${authorParts.join(' && ')}}`);
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

      // 9. Add fields (if any)
      if (messageEmbed.fields && messageEmbed.fields.length > 0) {
        messageEmbed.fields.forEach(field => {
          let fieldParts = [`name: ${field.name}`, `value: ${field.value}`];
          if (field.inline) fieldParts.push('inline');
          parts.push(`{field: ${fieldParts.join(' && ')}}`);
        });
      }

      // 10. Add timestamp (if exists)
      if (messageEmbed.timestamp) {
        parts.push(`{timestamp}`);
      }

      // 11. Add footer
      if (messageEmbed.footer) {
        let footerParts = [];
        if (messageEmbed.footer.text) footerParts.push(`text: ${messageEmbed.footer.text}`);
        if (messageEmbed.footer.iconURL) footerParts.push(`icon: ${messageEmbed.footer.iconURL}`);
        if (footerParts.length > 0) {
          parts.push(`{footer: ${footerParts.join(' && ')}}`);
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
                  buttonParts.push('link');
                  buttonParts.push(button.label || '');
                  buttonParts.push(button.url || '');
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
                  } else {
                    buttonParts.push(''); // Empty emoji slot
                  }
                  buttonParts.push(button.disabled ? 'disabled' : 'enabled');
                }

                parts.push(`{button: ${buttonParts.join(' && ')}}`);
              }
            });
          }
        });
      }

      return parts.join('$v');
    }
  }
}
