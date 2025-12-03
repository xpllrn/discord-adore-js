const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, emojis } = require('../../config/setup');
const { embeds } = require('../../core/embeds');



class CustomEmbedBuilder {
    // Helper method to validate emoji
    isValidEmoji(emoji) {
        if (!emoji || typeof emoji !== 'string') return false;

        // Check for custom Discord emoji format <:name:id> or <a:name:id>
        if (emoji.match(/^<a?:\w+:\d+>$/)) {
            return true;
        }

        // Check for Unicode emoji (basic check for common emoji patterns)
        // This is a simple check - Discord will validate the actual emoji
        if (emoji.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u)) {
            return true;
        }

        // Check for other common emoji characters
        if (emoji.match(/[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]/u)) {
            return true;
        }

        // If it's a single character and not obviously text, assume it might be an emoji
        if (emoji.length === 1 || (emoji.length === 2 && emoji.charCodeAt(0) > 127)) {
            return true;
        }

        return false;
    }

    constructor(channel, string, variables = {}, message = null) {
        const Embed = new EmbedBuilder(); let Content = ''; const Buttons = [];

        // Parse parameters by finding complete blocks between { and }$v or end
        const parseParameters = (input) => {
            const parameters = [];
            let i = 0;

            while (i < input.length) {
                if (input[i] === '{') {
                    let braceCount = 1;
                    let start = i + 1;
                    let j = i + 1;

                    // Find the matching closing brace, accounting for nested braces
                    while (j < input.length && braceCount > 0) {
                        if (input[j] === '{') braceCount++;
                        else if (input[j] === '}') braceCount--;
                        j++;
                    }

                    if (braceCount === 0) {
                        const content = input.substring(start, j - 1);
                        parameters.push(content);

                        // Skip $v if present
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

        const parameters = parseParameters(string);

        for (const param of parameters) {
            const colonIndex = param.indexOf(':');
            if (colonIndex === -1) {
                // Handle special cases like timestamp (case-insensitive)
                if (param.trim().toLowerCase() === 'timestamp') {
                    Embed.setTimestamp();
                }
                continue;
            }

            const paramName = param.substring(0, colonIndex).trim().toLowerCase();
            const paramValue = param.substring(colonIndex + 1).trim();

            // Handle the parameter based on its name (case-insensitive)
            if (paramName === 'title') {
                Embed.setTitle(paramValue);
            } else if (paramName === 'description') {
                Embed.setDescription(paramValue);
            } else if (paramName === 'color') {
                Embed.setColor(paramValue);
            } else if (paramName === 'thumbnail') {
                // Only set thumbnail if it's a valid URL
                if (paramValue && (paramValue.startsWith('http://') || paramValue.startsWith('https://'))) {
                    Embed.setThumbnail(paramValue);
                }
            } else if (paramName === 'image') {
                // Only set image if it's a valid URL
                if (paramValue && (paramValue.startsWith('http://') || paramValue.startsWith('https://'))) {
                    Embed.setImage(paramValue);
                }
            } else if (paramName === 'url') {
                // Only set URL if it's a valid URL
                if (paramValue && (paramValue.startsWith('http://') || paramValue.startsWith('https://'))) {
                    Embed.setURL(paramValue);
                }
            } else if (paramName === 'message' || paramName === 'content') {
                Content = paramValue;
            } else if (paramName === 'author') {
                // Handle author parameter
                if (paramValue.includes('&&')) {
                    const authorParts = paramValue.split('&&');
                    const name = authorParts[0]?.trim();
                    const iconURL = authorParts[1]?.trim();
                    const url = authorParts[2]?.trim();
                    if (name) {
                        const authorData = { name };
                        // Only add iconURL if it's a valid URL
                        if (iconURL && (iconURL.startsWith('http://') || iconURL.startsWith('https://'))) {
                            authorData.iconURL = iconURL;
                        }
                        // Only add url if it's a valid URL
                        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                            authorData.url = url;
                        }
                        Embed.setAuthor(authorData);
                    }
                } else {
                    Embed.setAuthor({ name: paramValue });
                }
            } else if (paramName === 'footer') {
                // Handle footer parameter
                if (paramValue.includes('&&')) {
                    const footerParts = paramValue.split('&&');
                    const text = footerParts[0]?.trim();
                    const iconURL = footerParts[1]?.trim();
                    if (text) {
                        const footerData = { text };
                        // Only add iconURL if it's a valid URL
                        if (iconURL && (iconURL.startsWith('http://') || iconURL.startsWith('https://'))) {
                            footerData.iconURL = iconURL;
                        }
                        Embed.setFooter(footerData);
                    }
                } else {
                    Embed.setFooter({ text: paramValue });
                }
            } else if (paramName === 'field') {
                // Handle field parameter
                if (paramValue.includes('&&')) {
                    const fieldParts = paramValue.split('&&');
                    const name = fieldParts[0]?.trim();
                    const value = fieldParts[1]?.trim();
                    const inline = fieldParts[2]?.trim() === 'true';
                    if (name && value) {
                        Embed.addFields({ name, value, inline });
                    }
                }
            } else if (paramName === 'button') {
                // Handle button parameter
                if (paramValue.includes('&&')) {
                    const buttonParts = paramValue.split('&&');
                    const styleOrUrl = buttonParts[0]?.trim();
                    const label = buttonParts[1]?.trim();
                    const emojiOrState = buttonParts[2]?.trim();
                    const fourthParam = buttonParts[3]?.trim();

                    if (styleOrUrl && label) {
                        const button = new ButtonBuilder();

                        // Check if it's a welcome button
                        if (styleOrUrl.toLowerCase() === 'welcome') {
                            // For welcome buttons, the 3rd parameter can be either emoji OR welcome message
                            // If 4th parameter exists, 3rd is emoji and 4th is message
                            // If only 3rd parameter exists, it's the welcome message
                            let emoji = '';
                            let message = '';
                            
                            if (fourthParam) {
                                // 4 parameters: welcome && label && emoji && message
                                emoji = emojiOrState;
                                message = fourthParam;
                            } else {
                                // 3 parameters: welcome && label && message
                                message = emojiOrState;
                            }

                            // Encode welcome message in custom ID (base64 to handle special characters)
                            const encodedMessage = message ? Buffer.from(message).toString('base64') : '';
                            const customId = `welcome_${encodedMessage}_${Date.now()}`.substring(0, 100); // Discord limit

                            button.setStyle(ButtonStyle.Secondary) // Always grey for welcome buttons
                                .setLabel(label)
                                .setCustomId(customId);

                            // Add emoji if provided and valid
                            if (emoji && this.isValidEmoji(emoji)) {
                                button.setEmoji(emoji);
                            }
                        }
                        // Check if it's a URL button
                        else if (styleOrUrl.startsWith('http')) {
                            button.setStyle(ButtonStyle.Link)
                                .setURL(styleOrUrl)
                                .setLabel(label);
                        } else {
                            // Style button
                            let style = ButtonStyle.Secondary; // Default
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
                                case 'link':
                                    style = ButtonStyle.Link;
                                    break;
                            }

                            button.setStyle(style)
                                .setLabel(label)
                                .setCustomId(`custom_button_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

                            // Add emoji for regular buttons if provided and valid
                            if (emojiOrState && this.isValidEmoji(emojiOrState)) {
                                button.setEmoji(emojiOrState);
                            }
                        }

                        // Handle disabled state for all button types (check both 3rd and 4th parameter)
                        const isDisabled = emojiOrState === 'disabled' || emojiOrState === 'disable' || 
                                          fourthParam === 'disabled' || fourthParam === 'disable';
                        if (isDisabled) {
                            button.setDisabled(true);
                        }

                        Buttons.push(button);
                    }
                }
            }
        }

        // Create action rows for buttons (max 5 buttons per row, max 5 rows)
        const components = []
        if (Buttons.length > 0) {
            for (let i = 0; i < Buttons.length; i += 5) {
                const row = new ActionRowBuilder()
                    .addComponents(Buttons.slice(i, i + 5))
                components.push(row)

                // Discord allows max 5 action rows
                if (components.length >= 5) break
            }
        }

        const messageOptions = {
            embeds: [Embed],
            content: Content.length > 0 && Content !== 'nil' ? Content : null
        }

        if (components.length > 0) {
            messageOptions.components = components
        }

        channel.send(messageOptions).then((sentMessage) => {
            // Check if there are any welcome buttons to set up timeout for
            const hasWelcomeButtons = Buttons.some(button =>
                button.data && button.data.custom_id && button.data.custom_id.startsWith('welcome_')
            );

            if (hasWelcomeButtons) {
                // Set up 60-second timeout to disable welcome buttons
                setTimeout(async () => {
                    try {
                        // Fetch the message to make sure it still exists
                        const message = await channel.messages.fetch(sentMessage.id).catch(() => null);
                        if (!message) return;

                        // Create new components with disabled welcome buttons
                        const updatedComponents = [];
                        for (const row of message.components) {
                            const updatedRow = new ActionRowBuilder();
                            for (const button of row.components) {
                                const newButton = new ButtonBuilder(button.data);

                                // Disable welcome buttons only
                                if (button.customId && button.customId.startsWith('welcome_')) {
                                    newButton.setDisabled(true);
                                }

                                updatedRow.addComponents(newButton);
                            }
                            updatedComponents.push(updatedRow);
                        }

                        // Update the message with disabled welcome buttons
                        await message.edit({ components: updatedComponents });
                    } catch (error) {
                        // Silent fail - message might have been deleted or bot lacks permissions
                    }
                }, 120000); // 120 seconds
            }
        }).catch((error) => {
            // Log error to webhook if available
            if (channel.client?.errorLogger) {
                channel.client.errorLogger.log(error, 'Embed Send Error', {
                    command: 'Embed Builder',
                    args: `Channel: ${channel.name || 'Unknown'}`,
                    guild: channel.guild,
                    channel: channel
                }).catch(() => {
                    // Silent fail for error logger
                });
            }

            // Create fake message object for embeds.deny
            const fakeMessage = message || {
                author: variables.user || { id: 'unknown' },
                channel: {
                    send: async (options) => {
                        return await channel.send(options);
                    }
                }
            };

            return embeds.deny(fakeMessage, `There's something wrong with your embed code, please check again.`).catch(() => {
                return embeds.deny(fakeMessage, 'Invalid embed code, try again')
            })
        })
    }
}



// Unified embed/text processor with variable replacement
class EmbedVariableProcessor {
    static process(channel, input, variables = {}, message = null) {
        // Check if input starts with {v2} or {container} - Components V2 mode
        if (input.trim().startsWith('{v2}') || input.trim().startsWith('{container}')) {
            // Components V2 mode - remove prefix and process as container
            const containerContent = input.replace(/^\s*{v2}\s*\$v\s*/, '').replace(/^\s*{container}\s*\$v\s*/, '');
            const { CustomContainerBuilder } = require('./containerbuilder');
            return new CustomContainerBuilder(channel, containerContent, variables, message);
        } else if (input.trim().startsWith('{embed}')) {
            // Embed mode - remove {embed} prefix and process as embed
            const embedContent = input.replace(/^\s*{embed}\s*\$v\s*/, '');
            return this.processAsEmbed(channel, embedContent, variables, message);
        } else {
            // Text mode - process variables and send as regular message
            return this.processAsText(channel, input, variables);
        }
    }

    static processAsEmbed(channel, embedContent, variables = {}, message = null) {
        // Apply variable replacements
        let processedContent = this.replaceVariables(embedContent, variables);

        // Validate embed syntax and attempt auto-correction
        const validation = this.validateEmbedSyntax(processedContent);
        if (!validation.valid) {
            // Try to auto-correct missing closing braces
            const correctionResult = this.attemptAutoCorrection(processedContent);
            if (correctionResult.corrected) {
                // Use the corrected content
                processedContent = correctionResult.content;
            } else {
                // Show error if auto-correction failed
                const fakeMessage = message || {
                    author: variables.user || { id: 'unknown' },
                    channel: {
                        send: async (options) => {
                            return await channel.send(options);
                        }
                    }
                };

                return embeds.warn(fakeMessage, `**I was unable to understand this due to errors, solve the following**:\n\n\`\`\`\n${validation.error}\n\`\`\``);
            }
        }

        // Clean up nil values in the processed content
        processedContent = this.cleanNilValues(processedContent);

        // Create embed using CustomEmbedBuilder
        return new CustomEmbedBuilder(channel, processedContent, variables, message);
    }

    static processAsText(channel, textContent, variables = {}) {
        // Apply variable replacements to text
        const processedText = this.replaceVariables(textContent, variables);
        return channel.send({ content: processedText });
    }

    static replaceVariables(content, variables = {}) {
        let processed = content;

        // Replace user variables if provided
        if (variables.user) {
            // Get display name with proper fallback
            let displayName = variables.user.displayName || variables.user.username;

            // If user doesn't have displayName, try to get it from guild member
            if (!variables.user.displayName && variables.guild && variables.guild.members) {
                const member = variables.guild.members.cache.get(variables.user.id);
                if (member) {
                    displayName = member.displayName || member.user.username;
                }
            }

            processed = processed.replace(/{user}/g, displayName);
            processed = processed.replace(/{user\.mention}/g, `<@${variables.user.id}>`);
            processed = processed.replace(/{user\.name}/g, variables.user.username);
            processed = processed.replace(/{user\.id}/g, variables.user.id);
            processed = processed.replace(/{user\.display_name}/g, displayName);
            processed = processed.replace(/{user\.tag}/g, variables.user.discriminator || variables.user.tag || 'N/A');
            processed = processed.replace(/{user\.avatar}/g, variables.user.displayAvatarURL ? variables.user.displayAvatarURL({ dynamic: true }) : 'N/A');
            processed = processed.replace(/{user\.guild_avatar}/g, variables.user.avatarURL ? (variables.user.avatarURL({ dynamic: true }) || 'N/A') : 'N/A');
            processed = processed.replace(/{user\.display_avatar}/g, variables.user.displayAvatarURL ? variables.user.displayAvatarURL({ dynamic: true }) : 'N/A');

            // User timestamps
            if (variables.guild && variables.guild.members) {
                const member = variables.guild.members.cache.get(variables.user.id);
                if (member) {
                    processed = processed.replace(/{user\.joined}/g, member.joinedAt ? member.joinedAt.toUTCString() : 'N/A');
                    processed = processed.replace(/{user\.joined_timestamp}/g, member.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000).toString() : 'N/A');
                    processed = processed.replace(/{user\.boost}/g, member.premiumSince ? 'Yes' : 'No');
                    processed = processed.replace(/{user\.color}/g, member.displayHexColor || '#000000');
                    processed = processed.replace(/{boost\.count}/g, variables.guild.premiumSubscriptionCount?.toString() || '0');
                }
            }

            processed = processed.replace(/{user\.created}/g, variables.user.createdAt ? variables.user.createdAt.toUTCString() : 'N/A');
            processed = processed.replace(/{user\.created_timestamp}/g, variables.user.createdAt ? Math.floor(variables.user.createdAt.getTime() / 1000).toString() : 'N/A');
        }

        // Replace guild variables if provided
        if (variables.guild) {
            processed = processed.replace(/{guild\.name}/g, variables.guild.name);
            processed = processed.replace(/{guild\.id}/g, variables.guild.id);

            // Handle member count with fallback
            const memberCount = variables.guild.memberCount || variables.guild.approximateMemberCount || 'N/A';
            processed = processed.replace(/{guild\.count}/g, memberCount.toString());
            processed = processed.replace(/{member\.count}/g, memberCount.toString());
            processed = processed.replace(/{guild\.membercount}/g, memberCount.toString());
            processed = processed.replace(/{guild\.region}/g, variables.guild.preferredLocale || 'N/A');
            processed = processed.replace(/{guild\.owner_id}/g, variables.guild.ownerId || 'N/A');
            processed = processed.replace(/{guild\.created_at}/g, variables.guild.createdAt ? variables.guild.createdAt.toUTCString() : 'N/A');
            processed = processed.replace(/{guild\.created_at_timestamp}/g, variables.guild.createdAt ? Math.floor(variables.guild.createdAt.getTime() / 1000).toString() : 'N/A');
            processed = processed.replace(/{guild\.emoji_count}/g, variables.guild.emojis?.cache?.size?.toString() || 'N/A');
            processed = processed.replace(/{guild\.role_count}/g, variables.guild.roles?.cache?.size?.toString() || 'N/A');
            processed = processed.replace(/{guild\.boost_count}/g, variables.guild.premiumSubscriptionCount?.toString() || '0');
            processed = processed.replace(/{guild\.boost_tier}/g, variables.guild.premiumTier ? `Level ${variables.guild.premiumTier}` : 'No Level');
            processed = processed.replace(/{guild\.icon}/g, variables.guild.iconURL ? (variables.guild.iconURL({ dynamic: true }) || 'N/A') : 'N/A');
            processed = processed.replace(/{guild\.banner}/g, variables.guild.bannerURL ? (variables.guild.bannerURL({ dynamic: true }) || 'N/A') : 'N/A');
            processed = processed.replace(/{guild\.splash}/g, variables.guild.splashURL ? (variables.guild.splashURL({ dynamic: true }) || 'N/A') : 'N/A');
            processed = processed.replace(/{guild\.vanity}/g, variables.guild.vanityURLCode || 'N/A');

            // Support legacy server variables for backward compatibility
            processed = processed.replace(/{server\.name}/g, variables.guild.name);
            processed = processed.replace(/{server\.membercount}/g, memberCount.toString());

            // Calculate ordinal for humanmembercount
            const ordinal = (memberCount.toString().endsWith(1) && !memberCount.toString().endsWith(11)) ? 'st' :
                (memberCount.toString().endsWith(2) && !memberCount.toString().endsWith(12)) ? 'nd' :
                    (memberCount.toString().endsWith(3) && !memberCount.toString().endsWith(13)) ? 'rd' : 'th';
            processed = processed.replace(/{server\.humanmembercount}/g, memberCount + ordinal);
        }

        // Replace channel variables if provided
        if (variables.channel) {
            processed = processed.replace(/{channel\.name}/g, variables.channel.name);
            processed = processed.replace(/{channel\.id}/g, variables.channel.id);
            processed = processed.replace(/{channel\.mention}/g, `<#${variables.channel.id}>`);
            processed = processed.replace(/{channel\.topic}/g, variables.channel.topic || 'N/A');
            processed = processed.replace(/{channel\.type}/g, variables.channel.type?.toString() || 'N/A');
            processed = processed.replace(/{channel\.category_id}/g, variables.channel.parentId || 'N/A');
            processed = processed.replace(/{channel\.category_name}/g, variables.channel.parent?.name || 'N/A');
            processed = processed.replace(/{channel\.slowmode_delay}/g, variables.channel.rateLimitPerUser?.toString() || '0');
        }

        // Replace vanity variables if provided
        if (variables.vanity) {
            processed = processed.replace(/{vanity}/g, variables.vanity);
            processed = processed.replace(/{vanity\.text}/g, variables.vanity);
        }

        if (variables.roles) {
            processed = processed.replace(/{vanity\.roles}/g, variables.roles);
            processed = processed.replace(/{roles}/g, variables.roles);
        }

        // Replace source variable if provided
        if (variables.source) {
            processed = processed.replace(/{source}/g, variables.source);
            processed = processed.replace(/{vanity\.source}/g, variables.source);
        }

        // Replace level variables if provided
        if (variables.level) {
            processed = processed.replace(/{level\.new_rank}/g, variables.level.new_rank?.toString() || 'N/A');
            processed = processed.replace(/{level\.rank}/g, variables.level.new_rank?.toString() || 'N/A'); // Alias
        }



        // Replace time variables
        const now = new Date();
        processed = processed.replace(/{time\.now}/g, now.toLocaleTimeString('en-US', { timeZone: 'UTC', hour12: true }));
        processed = processed.replace(/{time\.now_millitary}/g, now.toLocaleTimeString('en-US', { timeZone: 'UTC', hour12: false }));
        processed = processed.replace(/{time\.now_timestamp}/g, Math.floor(now.getTime() / 1000).toString());

        return processed;
    }

    static cleanNilValues(content) {
        // Remove content parameters that only contain 'nil'
        content = content.replace(/\{content:\s*nil\s*\}\$v/g, '');
        content = content.replace(/\{message:\s*nil\s*\}\$v/g, '');

        // Clean up any remaining standalone nil content at the end
        content = content.replace(/\{content:\s*nil\s*\}$/g, '');
        content = content.replace(/\{message:\s*nil\s*\}$/g, '');

        // Clean up double $v separators that might result from removing content
        content = content.replace(/\$v\$v/g, '$v');
        content = content.replace(/^\$v/, ''); // Remove leading $v
        content = content.replace(/\$v$/, ''); // Remove trailing $v

        return content;
    }

    static attemptAutoCorrection(input) {
        try {
            let corrected = input;
            let madeCorrections = false;

            // Find unclosed braces and attempt to fix them
            let braceStack = [];

            for (let i = 0; i < corrected.length; i++) {
                const char = corrected[i];

                if (char === '{') {
                    braceStack.push(i);
                } else if (char === '}') {
                    if (braceStack.length > 0) {
                        braceStack.pop();
                    }
                } else if (corrected.substring(i, i + 2) === '$v' && braceStack.length > 0) {
                    // Found $v separator with unclosed brace - add closing brace before $v
                    corrected = corrected.substring(0, i) + '}' + corrected.substring(i);
                    braceStack.pop();
                    madeCorrections = true;
                    i++; // Skip the added brace
                }
            }

            // Add closing braces for any remaining unclosed braces at the end
            while (braceStack.length > 0) {
                corrected += '}';
                braceStack.pop();
                madeCorrections = true;
            }

            // Validate the corrected content
            if (madeCorrections) {
                const validation = this.validateEmbedSyntax(corrected);
                if (validation.valid) {
                    return { corrected: true, content: corrected };
                }
            }

            return { corrected: false, content: input };
        } catch (error) {
            return { corrected: false, content: input };
        }
    }

    static validateEmbedSyntax(input) {
        try {
            // More precise brace validation - find exactly where the issue is
            let braceStack = [];
            let currentParam = '';
            let paramCount = 0;

            for (let i = 0; i < input.length; i++) {
                const char = input[i];

                if (char === '{') {
                    braceStack.push({ char: '{', index: i, param: paramCount });
                    if (currentParam === '') {
                        // Starting a new parameter
                        paramCount++;
                        currentParam = input.substring(i).split('$v')[0];
                    }
                } else if (char === '}') {
                    if (braceStack.length === 0) {
                        return {
                            valid: false,
                            error: `Unexpected closing brace '}' at position ${i + 1}. No matching opening brace found.`
                        };
                    }
                    braceStack.pop();
                    currentParam = '';
                } else if (input.substring(i, i + 2) === '$v') {
                    currentParam = '';
                    i++; // Skip the 'v' part
                }
            }

            // Check for unmatched opening braces
            if (braceStack.length > 0) {
                const unclosed = braceStack[braceStack.length - 1];
                const paramText = input.substring(unclosed.index).split('$v')[0];
                const paramName = paramText.match(/{([^:]+):/)?.[1] || 'unknown';

                return {
                    valid: false,
                    error: `Missing closing brace '}' for parameter "${paramName}" at position ${unclosed.index + 1}. Found: "${paramText}"`
                };
            }

            // Split by $v to get individual parameters for detailed validation
            const parts = input.split('$v');

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i].trim();
                if (!part) continue;

                // Check if part starts with { and ends with }
                if (!part.startsWith('{')) {
                    return {
                        valid: false,
                        error: `Parameter ${i + 1} "${part}" must start with opening brace '{'. Found: "${part.charAt(0)}"`
                    };
                }

                if (!part.endsWith('}')) {
                    return {
                        valid: false,
                        error: `Parameter ${i + 1} "${part}" must end with closing brace '}'. Missing closing brace for this parameter.`
                    };
                }

                // Extract parameter content
                const content = part.slice(1, -1);

                // Handle special case for timestamp parameter (no colon needed)
                let paramName, paramValue;
                if (content.toLowerCase() === 'timestamp') {
                    paramName = 'timestamp';
                    paramValue = 'true'; // timestamp doesn't need a value
                } else {
                    // Check if parameter has a colon
                    if (!content.includes(':')) {
                        return {
                            valid: false,
                            error: `Parameter ${i + 1} "${part}" is missing colon ':' to separate parameter name from content. Format should be {parameter: content}`
                        };
                    }

                    // Split by colon to get parameter name and value
                    const colonIndex = content.indexOf(':');
                    paramName = content.substring(0, colonIndex).trim().toLowerCase();
                    paramValue = content.substring(colonIndex + 1).trim();
                }

                // Check if parameter name is valid
                const validParams = [
                    'title', 'description', 'color', 'url', 'thumbnail', 'image', 'timestamp',
                    'author', 'field', 'footer', 'button', 'message', 'content'
                ];

                if (!validParams.includes(paramName)) {
                    return {
                        valid: false,
                        error: `Invalid parameter name "${paramName}" in parameter ${i + 1}. Valid parameters: ${validParams.join(', ')}`
                    };
                }

                // Check if parameter value is empty (allow empty for button and timestamp parameters)
                if (!paramValue && paramName !== 'button' && paramName !== 'timestamp') {
                    return {
                        valid: false,
                        error: `Parameter "${paramName}" has empty content. Please provide a value after the colon.`
                    };
                }
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: `Syntax parsing error: ${error.message}`
            };
        }
    }
}

module.exports = {
    EmbedBuilder: CustomEmbedBuilder,
    EmbedVariableProcessor,
    MessageProcessor: EmbedVariableProcessor // Alias for backward compatibility
};
