// Message handler for command processing, autoreact, and autoresponder
const { processCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: 'messageCreate',
  async execute(message) {

    // Skip bots
    if (message.author.bot) return;

    // Skip if no guild
    if (!message.guild) return;

    // CRITICAL: Skip all message processing until cache is ready
    if (!message.client.cacheReady) {
      return; // Don't process any messages during startup
    }

    // Process vleed mentions first (highest priority)
    await processVleedMention(message);

    // Process bot mention with link
    await processBotMentionDownload(message);

    // Process autoreacts
    await processAutoreact(message);

    // Process autoresponders
    await processAutoresponder(message);



    // Process message tracking
    await processMessageTracking(message);

    // Process sticky message activity tracking
    await processStickyMessageActivity(message);

    // Process swear tracking
    await processSwearTracking(message);

    // Process level system (XP gaining)
    await processLevelSystem(message);

    // Process counting game
    await processCounting(message);

    // Process commands last
    await processCommand(message, false);
  },
};

async function processCounting(message) {
    try {
        const { getService } = require('@services');
        const guildService = getService('guild');
        const countingData = await guildService.getCounting(message.guild.id);

        if (message.channel.id === countingData.channelId) {
            const { embeds } = require('../../core/embeds');
            
            // Try to evaluate the message as a math expression or extract number
            let num = null;
            const content = message.content.trim();
            
            // First, try to extract just a number (supports "10 hello" or "hello 10" or just "10")
            const numMatch = content.match(/\d+/);
            if (numMatch) {
                num = parseInt(numMatch[0]);
            }
            
            // If no simple number found, try to evaluate as math expression
            if (num === null || content.includes('+') || content.includes('-') || content.includes('*') || content.includes('/') || content.includes('√')) {
                try {
                    // Replace √ with Math.sqrt
                    let mathExpr = content.replace(/√(\d+)/g, 'Math.sqrt($1)');
                    // Remove any non-math characters for safety
                    mathExpr = mathExpr.replace(/[^0-9+\-*/().\s]/g, '');
                    
                    // Safely evaluate the expression
                    if (mathExpr.trim()) {
                        const result = Function('"use strict"; return (' + mathExpr + ')')();
                        if (!isNaN(result) && isFinite(result)) {
                            num = Math.round(result);
                        }
                    }
                } catch (e) {
                    // If math evaluation fails, stick with extracted number
                }
            }
            
            // If still no valid number, ignore the message (don't delete)
            if (num === null || isNaN(num)) {
                return;
            }

            // Check if same person is counting twice
            if (message.author.id === countingData.lastCounterId) {
                await embeds.deny(message, 'You cannot count twice in a row!');
                return;
            }

            // Check if the number is correct
            if (num === countingData.currentCount + 1) {
                countingData.currentCount++;
                countingData.lastCounterId = message.author.id;
                await guildService.setCounting(message.guild.id, countingData);
                
                // React with party emoji for every 100, 200, 300, etc.
                if (num % 100 === 0) {
                    await message.react('🎉');
                } else {
                    const { emojis } = require('../../config/setup');
                    await message.react(emojis.success);
                }
            } else {
                // Wrong number - handle based on strict mode
                const isStrict = countingData.strict !== false; // Default to true if not set
                
                if (isStrict) {
                    // Strict mode: reset count
                    const wrongCount = countingData.currentCount;
                    countingData.currentCount = 0;
                    countingData.lastCounterId = null;
                    await guildService.setCounting(message.guild.id, countingData);
                    
                    await embeds.deny(message, `ruined it at **${wrongCount}**! Next number is **1**.`);
                } else {
                    // Non-strict mode: just notify but don't reset
                    await embeds.deny(message, `Wrong number! Expected **${countingData.currentCount + 1}** but got **${num}**. Next number is still **${countingData.currentCount + 1}**.`);
                }
            }
        }
    } catch (error) {
        console.error('Error processing count:', error);
    }
}

async function processAutoreact(message) {
  try {
    // Skip if message is empty or only whitespace
    if (!message.content || !message.content.trim()) return;

    const { getService } = require('@services');
    const guildService = getService('guild');

    // Get all autoreacts for this guild using service layer
    const autoreacts = await guildService.getAutoReacts(message.guild.id);

    if (!autoreacts || autoreacts.length === 0) return;

    const messageContent = message.content.toLowerCase();

    // Check each autoreact trigger
    for (const autoreact of autoreacts) {
      // Check if the message contains the trigger word
      if (messageContent.includes(autoreact.word.toLowerCase())) {
        try {
          let emojiToReact;

          if (autoreact.isCustom) {
            // For custom emojis, check if it still exists in the guild
            const emoji = message.guild.emojis.cache.get(autoreact.emojiId);
            if (emoji) {
              emojiToReact = emoji;
            } else {
              // Remove invalid emoji using service layer
              await guildService.removeAutoReact(message.guild.id, autoreact.word);
              continue;
            }
          } else {
            // For unicode emojis
            emojiToReact = autoreact.emojiName;
          }

          // React to the message
          await message.react(emojiToReact);
        } catch (error) {
          // Silent fail for individual reactions
          // Could be due to missing permissions, invalid emoji, etc.
        }
      }
    }
  } catch (error) {
    // Silent fail for autoreact system
  }
}

async function processAutoresponder(message) {
  try {
    // Skip if message is empty or only whitespace
    if (!message.content || !message.content.trim()) return;

    const { getService } = require('@services');
    const guildService = getService('guild');

    // Get all autoresponders for this guild using service layer
    const autoresponders = await guildService.getAutoResponders(message.guild.id);

    if (!autoresponders || autoresponders.length === 0) return;

    const messageContent = message.content;

    // Check each autoresponder trigger
    for (const autoresponder of autoresponders) {
      let triggered = false;

      // Ensure strict is properly defined (fix for legacy autoresponders)
      const isStrict = autoresponder.strict !== undefined ? autoresponder.strict : true;

      if (isStrict) {
        // Strict mode: exact message match (case insensitive)
        triggered = messageContent.toLowerCase().trim() === autoresponder.trigger.toLowerCase();
      } else {
        // Non-strict mode: contains trigger anywhere in message (case insensitive)
        triggered = messageContent.toLowerCase().includes(autoresponder.trigger.toLowerCase());
      }

      if (triggered) {
        try {
          // Delete original message if delete option is enabled
          if (autoresponder.delete) {
            try {
              await message.delete();
            } catch (error) {
              // Silent fail if can't delete (missing permissions, etc.)
            }
          }

          // Send response
          let responseMessage;

          // Check if response contains embed syntax
          if (autoresponder.response.trim().startsWith('{embed}')) {
            // Use EmbedVariableProcessor for embed responses
            const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');

            const variables = {
              user: message.author,
              guild: message.guild,
              channel: message.channel
            };

            // Process the embed and send it
            responseMessage = await EmbedVariableProcessor.process(message.channel, autoresponder.response, variables);
          } else {
            // Regular text response
            if (autoresponder.reply) {
              responseMessage = await message.reply(autoresponder.response);
            } else {
              responseMessage = await message.channel.send(autoresponder.response);
            }
          }

          // Self-destruct if enabled
          if (autoresponder.selfDestruct > 0) {
            setTimeout(async () => {
              try {
                await responseMessage.delete();
              } catch (error) {
                // Silent fail if message was already deleted
              }
            }, autoresponder.selfDestruct * 1000);
          }

          // Only trigger one autoresponder per message
          break;

        } catch (error) {
          // Silent fail for individual autoresponder
        }
      }
    }
  } catch (error) {
    // Silent fail for autoresponder system
  }
}

async function processBotMentionDownload(message) {
  try {
    // Skip if message is empty or only whitespace
    if (!message.content || !message.content.trim()) return;

    const messageContent = message.content.toLowerCase().trim();

    // Check if message starts with bot name variations
    const botNames = ['vleed', message.client.user.username.toLowerCase()];
    const startsWithBotName = botNames.some(name =>
      messageContent.startsWith(name + ' ') ||
      messageContent.startsWith(name + '\n') ||
      messageContent === name
    );

    // Also check for @mentions as fallback
    const isMentioned = message.mentions.has(message.client.user);

    // Must start with bot name or be mentioned
    if (!startsWithBotName && !isMentioned) return;

    // Extract URLs from the message
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.content.match(urlRegex);

    if (!urls || urls.length === 0) return;

    // Check if any URL is from supported platforms
    const supportedUrl = urls.find(url =>
      url.match(/instagram\.com\/(p|reel|tv|stories)/) ||
      url.match(/tiktok\.com/)
    );

    if (!supportedUrl) return;

    // Import the download functions
    const { handleInstagramDownload, handleTikTokDownload } = require('../utility/downloadHandler');

    try {
      let success = false;

      if (supportedUrl.match(/instagram\.com\/(p|reel|tv|stories)/)) {
        success = await handleInstagramDownload(message, supportedUrl);
      } else if (supportedUrl.match(/tiktok\.com/)) {
        success = await handleTikTokDownload(message, supportedUrl);
      }

      // If download failed, react with eyes emoji
      if (!success) {
        await message.react('👀');
      }

    } catch (downloadError) {
      // If any error occurs, react with eyes emoji
      try {
        await message.react('👀');
      } catch (reactionError) {
        // Silent fail if can't react
      }
    }

  } catch (error) {
    // Silent fail for bot mention download system
  }
}



async function processMessageTracking(message) {
  try {
    // Skip bots
    if (message.author.bot) return;

    // Skip if message is empty or only whitespace
    if (!message.content || !message.content.trim()) return;

    // Ensure guild data exists
    const { ensureGuildData } = require('../../database');
    await ensureGuildData(message.guild.id);

    // Track the message using service layer
    const { getService } = require('@services');
    const guildService = getService('guild');
    await guildService.trackMessage(message.guild.id, message.author.id);

  } catch (error) {
    // Silent fail for message tracking
  }
}

async function processStickyMessageActivity(message) {
  try {
    // Skip bots
    if (message.author.bot) return;

    // Update sticky message activity for this channel using service layer
    const { getService } = require('@services');
    const guildService = getService('guild');
    await guildService.updateStickyMessageActivity(message.guild.id, message.channel.id);

  } catch (error) {
    // Silent fail for sticky message activity tracking
  }
}

async function processSwearTracking(message) {
  try {
    // Skip bots
    if (message.author.bot) return;

    // Skip if message is empty or only whitespace
    if (!message.content || !message.content.trim()) return;

    // Check if database models are available
    const { getModels, isDatabaseReady } = require('../../database');
    if (!isDatabaseReady()) {
      // Database not ready yet, skip swear tracking
      return;
    }

    const models = getModels();
    if (!models || !models.User || !models.Guild || !models.System) {
      // Database models not ready yet, skip swear tracking
      return;
    }

    // Ensure guild data exists
    const { ensureGuildData } = require('../../database');
    const guildData = await ensureGuildData(message.guild.id);



    // Import swear detection function
    const { detectSwears } = require('../../commands/service/swear');

    // Detect swears in the message
    const foundSwears = detectSwears(message.content);

    if (foundSwears.length > 0) {
      const { getService } = require('@services');
      const guildService = getService('guild');

      // Add each detected swear to the database using service layer
      for (const swear of foundSwears) {
        await guildService.addSwear(message.guild.id, message.author.id, swear);
      }
    }

  } catch (error) {
    // Send error to webhook instead of console
    if (message.client?.errorLogger) {
      message.client.errorLogger.log(error, 'Swear Tracking', {
        command: 'Swear Tracking',
        args: `Message: ${message.content?.substring(0, 50) || 'Unknown'}`,
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
  }
}

// Process vleed mentions
async function processVleedMention(message) {
  try {
    // Check if message starts with "vleed" (case insensitive)
    const content = message.content.toLowerCase();
    if (content.startsWith('vleed ')) {
      const { handleVleedMention } = require('../../commands/utility/responder');
      await handleVleedMention(message.client, message);
    }
  } catch (error) {
    // Silent fail for vleed mention processing
  }
}

// Process level system (XP gaining)
async function processLevelSystem(message) {
  try {
    // Skip bots
    if (message.author.bot) return;

    // Skip if message is empty or only whitespace
    if (!message.content || !message.content.trim()) return;

    // Skip if message is a command (starts with prefix)
    const { getService } = require('@services');
    const prefixService = getService('prefix');
    const guildPrefix = await prefixService.getGuildPrefix(message.guild.id);
    if (message.content.startsWith(guildPrefix)) return;

    const guildService = getService('guild');

    // Check if level system is enabled using service layer
    const isEnabled = await guildService.isLevelSystemEnabled(message.guild.id);
    if (!isEnabled) return;

    // Get user's current level data using service layer
    const userData = await guildService.getUserLevel(message.guild.id, message.author.id);

    // Check cooldown (prevent spam XP farming)
    const now = new Date();
    if (userData.lastMessageTime) {
      const timeDiff = now.getTime() - userData.lastMessageTime.getTime();
      if (timeDiff < 60000) return; // 1 minute cooldown
    }

    // Calculate XP gain (calibrated for level 10 in ~2 hours of active chatting)
    // Base XP: 10-15 random (lower than popular bots for slower progression)
    let xpGain = Math.floor(Math.random() * 6) + 10;

    // Length bonus: +1 XP per 8 words (encourages longer messages)
    const wordCount = message.content.trim().split(/\s+/).length;
    const lengthBonus = Math.floor(wordCount / 8);
    xpGain += lengthBonus;

    // Cap at 25 XP maximum (prevents abuse while allowing good progression)
    xpGain = Math.min(xpGain, 25);

    // Add XP and check for level up using service layer
    const result = await guildService.addUserExperience(message.guild.id, message.author.id, xpGain);

    // If user leveled up, send level up message
    if (result.leveledUp) {
      await handleLevelUp(message, result.newLevel, result.userData);
    }

  } catch (error) {
    // Silent fail for level system
    if (message.client?.errorLogger) {
      message.client.errorLogger.log(error, 'Level System Processing', {
        command: 'Level System XP Gain',
        args: `Message: ${message.content?.substring(0, 50) || 'Unknown'}`,
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
  }
}

// Handle level up notifications
async function handleLevelUp(message, newLevel, userData) {
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');
    const { EmbedBuilder } = require('discord.js');
    const { colors, emojis } = require('../../config/setup');
    const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');

    // Get message mode using service layer
    const messageMode = await guildService.getLevelMessageMode(message.guild.id);

    if (messageMode === 'none') return; // Level up messages disabled

    // Determine where to send the message
    let targetChannel = message.channel; // Default to context

    if (messageMode === 'channel') {
      const levelUpChannelId = await guildService.getLevelUpChannel(message.guild.id);
      if (levelUpChannelId) {
        const levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
        if (levelUpChannel) {
          targetChannel = levelUpChannel;
        }
      }
    }

    // Check for custom level message
    const customLevelMessage = await guildService.getLevelCustomMessage(message.guild.id);

    if (customLevelMessage) {
      // Use custom level message with variable processing
      EmbedVariableProcessor.process(targetChannel, customLevelMessage, {
        user: message.author,
        guild: message.guild,
        channel: targetChannel,
        level: { new_rank: newLevel }
      });
    } else {
      // Use default level up embed with user mention outside
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`**${message.member?.displayName || message.author.username}** had **leveled up**!\n> They are now **level ${newLevel}**, yayyyyy`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

      // Send level up message with ping outside embed
      await targetChannel.send({ 
        content: message.author.toString(),
        embeds: [embed] 
      });
    }

    // Check and assign level roles
    await assignLevelRoles(message, newLevel);

  } catch (error) {
    // Silent fail for level up message
  }
}

// Assign level roles when user levels up
async function assignLevelRoles(message, newLevel) {
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');

    // Get level roles using service layer
    const levelRoles = await guildService.getLevelRoles(message.guild.id);
    if (!levelRoles || levelRoles.length === 0) return;

    // Check if roles should stack
    const stackRoles = await guildService.getStackRoles(message.guild.id);

    if (stackRoles) {
      // Stack mode: Add all eligible roles
      const eligibleRoles = levelRoles.filter(lr => lr.level <= newLevel);

      for (const levelRole of eligibleRoles) {
        const role = message.guild.roles.cache.get(levelRole.roleId);
        if (role && !message.member.roles.cache.has(role.id)) {
          try {
            await message.member.roles.add(role);
          } catch (error) {
            // Silent fail if can't add role (permissions, hierarchy, etc.)
          }
        }
      }
    } else {
      // No stack mode: Only keep the highest level role
      const eligibleRoles = levelRoles.filter(lr => lr.level <= newLevel);
      
      if (eligibleRoles.length === 0) return;

      // Sort by level descending to get highest role first
      const sortedRoles = eligibleRoles.sort((a, b) => b.level - a.level);
      const highestLevelRole = sortedRoles[0];
      const highestRole = message.guild.roles.cache.get(highestLevelRole.roleId);

      if (!highestRole) return;

      // Remove all other level roles
      for (const levelRole of levelRoles) {
        if (levelRole.roleId !== highestLevelRole.roleId) {
          const role = message.guild.roles.cache.get(levelRole.roleId);
          if (role && message.member.roles.cache.has(role.id)) {
            try {
              await message.member.roles.remove(role);
            } catch (error) {
              // Silent fail
            }
          }
        }
      }

      // Add the highest level role
      if (!message.member.roles.cache.has(highestRole.id)) {
        try {
          await message.member.roles.add(highestRole);
        } catch (error) {
          // Silent fail
        }
      }
    }

  } catch (error) {
    // Silent fail for role assignment
  }
}
