const { 
    ContainerBuilder, 
    SectionBuilder, 
    MediaGalleryBuilder, 
    SeparatorBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorSpacingSize,
    AttachmentBuilder,
    FileBuilder,
    TextDisplayBuilder
} = require('discord.js');
const { colors } = require('../../config/setup');
const { embeds } = require('../../core/embeds');
const { EmbedVariableProcessor } = require('./embedbuilder');

class CustomContainerBuilder {
    // Helper method to validate emoji
    isValidEmoji(emoji) {
        if (!emoji || typeof emoji !== 'string') return false;

        // Check for custom Discord emoji format <:name:id> or <a:name:id>
        if (emoji.match(/^<a?:\w+:\d+>$/)) {
            return true;
        }

        // Check for Unicode emoji
        if (emoji.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u)) {
            return true;
        }

        if (emoji.match(/[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]/u)) {
            return true;
        }

        if (emoji.length === 1 || (emoji.length === 2 && emoji.charCodeAt(0) > 127)) {
            return true;
        }

        return false;
    }

    constructor(channel, string, variables = {}, message = null) {
        const Container = new ContainerBuilder();
        let Content = '';
        const Buttons = [];
        const Files = [];

        // Apply variable replacements first
        const processedString = EmbedVariableProcessor.replaceVariables(string, variables);

        // Parse parameters by finding complete blocks between { and }$v or end
        const parseParameters = (input) => {
            const parameters = [];
            let i = 0;

            while (i < input.length) {
                if (input[i] === '{') {
                    let braceCount = 1;
                    let start = i + 1;
                    let j = i + 1;

                    while (j < input.length && braceCount > 0) {
                        if (input[j] === '{') braceCount++;
                        else if (input[j] === '}') braceCount--;
                        j++;
                    }

                    if (braceCount === 0) {
                        const content = input.substring(start, j - 1);
                        parameters.push(content);

                        if (input.substring(j, j + 2) === '$v') {
                            j += 2;
                        }
                        i = j;
                    } else {
                        i++;
                    }
                } else {
                    i++;
                }
            }

            return parameters;
        };

        const parameters = parseParameters(processedString);

        for (const param of parameters) {
            const colonIndex = param.indexOf(':');
            
            // Handle separator (no colon) or with options
            if (param.trim().toLowerCase() === 'separator') {
                Container.addSeparatorComponents((separator) => separator);
                continue;
            }

            if (colonIndex === -1) continue;

            const paramName = param.substring(0, colonIndex).trim().toLowerCase();
            const paramValue = param.substring(colonIndex + 1).trim();

            if (paramName === 'text') {
                // Text display component
                Container.addTextDisplayComponents(
                    (text) => text.setContent(paramValue)
                );
            } else if (paramName === 'color') {
                // Accent color
                const colorValue = paramValue.startsWith('#') ? parseInt(paramValue.replace('#', ''), 16) : parseInt(paramValue, 16);
                Container.setAccentColor(colorValue);
            } else if (paramName === 'thumbnail') {
                // Standalone thumbnail in a section
                if (paramValue && (paramValue.startsWith('http://') || paramValue.startsWith('https://'))) {
                    Container.addSectionComponents((section) =>
                        section.setThumbnailAccessory((thumbnail) =>
                            thumbnail.setURL(paramValue).setDescription('Thumbnail')
                        )
                    );
                }
            } else if (paramName === 'image') {
                // Image as media gallery with single item
                if (paramValue && (paramValue.startsWith('http://') || paramValue.startsWith('https://'))) {
                    Container.addMediaGalleryComponents((gallery) =>
                        gallery.addItems((item) => item.setURL(paramValue).setDescription('Image'))
                    );
                }
            } else if (paramName === 'author') {
                // Author as section with text and optional thumbnail
                // Format: name&&icon_url OR just name
                const parts = paramValue.split('&&').map(p => p.trim());
                const authorName = parts[0];
                const authorIcon = parts[1];

                if (authorName) {
                    if (authorIcon && (authorIcon.startsWith('http://') || authorIcon.startsWith('https://'))) {
                        Container.addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((text) => text.setContent(`**${authorName}**`))
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail.setURL(authorIcon).setDescription('Author icon')
                                )
                        );
                    } else {
                        Container.addTextDisplayComponents(
                            (text) => text.setContent(`**${authorName}**`)
                        );
                    }
                }
            } else if (paramName === 'separator.line') {
                // Separator with divider line
                Container.addSeparatorComponents((separator) => 
                    separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
                );
            } else if (paramName === 'section') {
                // Section with text and optional thumbnail
                // Format: text content&&thumbnail_url
                // If last part after && is a URL, it's treated as thumbnail
                const parts = paramValue.split('&&');
                
                let textContent = paramValue;
                let thumbnailUrl = null;
                
                // Check if there's a && separator and last part is a URL
                if (parts.length === 2) {
                    const lastPart = parts[1].trim();
                    if (lastPart && (lastPart.startsWith('http://') || lastPart.startsWith('https://'))) {
                        thumbnailUrl = lastPart;
                        textContent = parts[0]; // Everything before &&
                    }
                }

                if (textContent.trim().length > 0) {
                    Container.addSectionComponents((section) => {
                        const sectionBuilder = section;
                        
                        // Add single text display with the content
                        sectionBuilder.addTextDisplayComponents(
                            (text) => text.setContent(textContent.trim())
                        );

                        // Add thumbnail if provided
                        if (thumbnailUrl) {
                            sectionBuilder.setThumbnailAccessory((thumbnail) =>
                                thumbnail.setURL(thumbnailUrl).setDescription('Image')
                            );
                        }

                        return sectionBuilder;
                    });
                }
            } else if (paramName === 'gallery') {
                // Media gallery with multiple images
                // Format: url1&&url2&&url3
                const urls = paramValue.split('&&').map(u => u.trim()).filter(u => u.startsWith('http://') || u.startsWith('https://'));
                
                if (urls.length > 0) {
                    Container.addMediaGalleryComponents((gallery) => {
                        urls.slice(0, 10).forEach(url => {
                            gallery.addItems((item) => item.setURL(url).setDescription('Image'));
                        });
                        return gallery;
                    });
                }
            } else if (paramName === 'message' || paramName === 'content') {
                Content = paramValue;
            } else if (paramName === 'button') {
                // Button component
                // Format: style&&label&&emoji&&disabled OR url&&label&&emoji
                const parts = paramValue.split('&&').map(p => p.trim());
                const styleOrUrl = parts[0];
                const label = parts[1];
                const emoji = parts[2];
                const disabled = parts[3]?.toLowerCase() === 'disabled' || parts[3]?.toLowerCase() === 'disable';

                if (styleOrUrl && label) {
                    const button = new ButtonBuilder();

                    if (styleOrUrl.startsWith('http')) {
                        // Link button
                        button.setStyle(ButtonStyle.Link)
                            .setURL(styleOrUrl)
                            .setLabel(label);
                        
                        // Add emoji if provided and valid
                        if (emoji && this.isValidEmoji(emoji)) {
                            button.setEmoji(emoji);
                        }
                    } else {
                        // Style button
                        let style = ButtonStyle.Secondary;
                        const styleLower = styleOrUrl.toLowerCase();
                        switch (styleLower) {
                            case 'primary':
                            case 'blurple':
                                style = ButtonStyle.Primary;
                                break;
                            case 'secondary':
                            case 'grey':
                            case 'gray':
                                style = ButtonStyle.Secondary;
                                break;
                            case 'success':
                            case 'green':
                                style = ButtonStyle.Success;
                                break;
                            case 'danger':
                            case 'red':
                                style = ButtonStyle.Danger;
                                break;
                        }

                        button.setStyle(style)
                            .setLabel(label)
                            .setCustomId(`custom_button_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

                        // Add emoji if provided and valid
                        if (emoji && this.isValidEmoji(emoji)) {
                            button.setEmoji(emoji);
                        }

                        // Set disabled state
                        if (disabled) {
                            button.setDisabled(true);
                        }
                    }

                    Buttons.push(button);
                }
            }
        }

        // Add buttons to container if any exist
        if (Buttons.length > 0) {
            for (let i = 0; i < Buttons.length; i += 5) {
                const buttonSlice = Buttons.slice(i, i + 5);
                Container.addActionRowComponents((actionRow) =>
                    actionRow.setComponents(...buttonSlice)
                );
                if (i / 5 >= 4) break; // Max 5 action rows
            }
        }

        // In Components V2, content must be added as a separate TextDisplayBuilder
        // OUTSIDE the container, not inside it
        const components = [];
        
        if (Content.length > 0 && Content !== 'nil') {
            // Add content as a separate text display component before the container
            components.push(new TextDisplayBuilder().setContent(Content));
        }
        
        // Add the container
        components.push(Container);

        const messageOptions = {
            components: components,
            flags: MessageFlags.IsComponentsV2
        };

        // Add files if any exist
        if (Files.length > 0) {
            messageOptions.files = Files;
        }

        channel.send(messageOptions).catch((error) => {
            console.error('Container send error:', error);
            
            // Don't send error messages to system, send to the actual user
            if (message && message.reply) {
                return message.reply({
                    content: `Failed to send container: ${error.message || 'Invalid container code'}`,
                    allowedMentions: { repliedUser: false }
                }).catch(() => {});
            }
        });
    }
}

module.exports = { CustomContainerBuilder };
