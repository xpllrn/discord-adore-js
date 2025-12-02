const { ContainerBuilder, SectionBuilder, MediaGalleryBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { colors } = require('../../config/setup');
const { embeds } = require('../../core/embeds');
const { EmbedVariableProcessor } = require('./embedbuilder');

class CustomContainerBuilder {
    constructor(channel, string, variables = {}) {
        const Container = new ContainerBuilder();
        let Content = '';
        const Buttons = [];

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
            
            // Handle separator (no colon)
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
            } else if (paramName === 'section') {
                // Section with text and optional thumbnail
                // Format: text1&&text2&&...&&thumbnail_url (up to 3 text displays)
                // If last part is a URL, it's treated as thumbnail
                const parts = paramValue.split('&&').map(p => p.trim());
                
                let textParts = [];
                let thumbnailUrl = null;
                
                // Check if last part is a URL (thumbnail)
                const lastPart = parts[parts.length - 1];
                if (lastPart && (lastPart.startsWith('http://') || lastPart.startsWith('https://'))) {
                    thumbnailUrl = lastPart;
                    textParts = parts.slice(0, -1); // All parts except last
                } else {
                    textParts = parts; // All parts are text
                }

                if (textParts.length > 0) {
                    Container.addSectionComponents((section) => {
                        const sectionBuilder = section;
                        
                        // Add up to 3 text displays
                        const textsToAdd = textParts.slice(0, 3).filter(t => t.length > 0);
                        if (textsToAdd.length > 0) {
                            sectionBuilder.addTextDisplayComponents(
                                ...textsToAdd.map(t => (text) => text.setContent(t))
                            );
                        }

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
            } else if (paramName === 'footer') {
                // Footer text (small text)
                Container.addTextDisplayComponents(
                    (text) => text.setContent(`-# ${paramValue}`)
                );
            } else if (paramName === 'message' || paramName === 'content') {
                Content = paramValue;
            } else if (paramName === 'button') {
                // Button component
                // Format: url&&label OR style&&label
                const parts = paramValue.split('&&');
                const styleOrUrl = parts[0]?.trim();
                const label = parts[1]?.trim();

                if (styleOrUrl && label) {
                    const button = new ButtonBuilder();

                    if (styleOrUrl.startsWith('http')) {
                        // Link button
                        button.setStyle(ButtonStyle.Link)
                            .setURL(styleOrUrl)
                            .setLabel(label);
                    } else {
                        // Style button
                        let style = ButtonStyle.Secondary;
                        const styleLower = styleOrUrl.toLowerCase();
                        switch (styleLower) {
                            case 'primary':
                            case 'blurple':
                                style = ButtonStyle.Primary;
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

        const messageOptions = {
            components: [Container],
            flags: MessageFlags.IsComponentsV2,
            content: Content.length > 0 && Content !== 'nil' ? Content : null
        };

        channel.send(messageOptions).catch((error) => {
            const fakeMessage = {
                author: { id: 'system' },
                channel: {
                    send: async (options) => {
                        return await channel.send(options);
                    }
                }
            };

            return embeds.deny(fakeMessage, `Failed to send container: ${error.message || 'Invalid container code'}`).catch(() => {
                return channel.send('Invalid container code, try again');
            });
        });
    }
}

module.exports = { CustomContainerBuilder };
