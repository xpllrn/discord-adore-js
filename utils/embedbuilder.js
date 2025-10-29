const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, emojis } = require('../config/setup');



class CustomEmbedBuilder {
    constructor(channel, string) {
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
                // Handle special cases like timestamp
                if (param.trim() === 'timestamp') {
                    Embed.setTimestamp();
                }
                continue;
            }
            
            const paramName = param.substring(0, colonIndex).trim();
            const paramValue = param.substring(colonIndex + 1).trim();
            
            // Handle the parameter based on its name
            if (paramName === 'title') {
                Embed.setTitle(paramValue);
            } else if (paramName === 'description') {
                Embed.setDescription(paramValue);
            } else if (paramName === 'color') {
                Embed.setColor(paramValue);
            } else if (paramName === 'thumbnail') {
                Embed.setThumbnail(paramValue);
            } else if (paramName === 'image') {
                Embed.setImage(paramValue);
            } else if (paramName === 'url') {
                Embed.setURL(paramValue);
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
                        Embed.setAuthor({ name, iconURL: iconURL || null, url: url || null });
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
                        Embed.setFooter({ text, iconURL: iconURL || null });
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

        channel.send(messageOptions).catch((error) => {
          console.error('Embed send error:', error)
          const errorEmbed = new EmbedBuilder()
            .setColor(colors.error || '#ff0000')
            .setDescription(`${emojis.error || '❌'} Failed to send embed: ${error.message || 'Invalid embed code'}`)
          return channel.send({ embeds: [errorEmbed] }).catch(() => {
            return channel.send('Invalid embed code, try again')
          })
        })
    }
}



// Unified embed/text processor with variable replacement
class EmbedVariableProcessor {
    static process(channel, input, variables = {}) {
        // Check if input starts with {embed} - this determines embed mode
        if (input.trim().startsWith('{embed}')) {
            // Embed mode - remove {embed} prefix and process as embed
            const embedContent = input.replace(/^\s*{embed}\s*\$v\s*/, '');
            return this.processAsEmbed(channel, embedContent, variables);
        } else {
            // Text mode - process variables and send as regular message
            return this.processAsText(channel, input, variables);
        }
    }

    static processAsEmbed(channel, embedContent, variables = {}) {
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
                const embed = new EmbedBuilder()
                    .setColor(colors.warn)
                    .setDescription(`**I was unable to understand this due to errors, solve the following**:\n\n\`\`\`\n${validation.error}\n\`\`\``)
                return channel.send({ embeds: [embed] });
            }
        }

        // Clean up nil values in the processed content
        processedContent = this.cleanNilValues(processedContent);

        // Create embed using CustomEmbedBuilder
        return new CustomEmbedBuilder(channel, processedContent);
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
                    processed = processed.replace(/{boost\.count}/g, member.premiumSince ? '1' : '0'); // Simplified boost count
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
                if (content === 'timestamp') {
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
                    paramName = content.substring(0, colonIndex).trim();
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
