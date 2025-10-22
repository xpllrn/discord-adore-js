// Message handler for command processing, autoreact, and autoresponder
const { processCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: 'messageCreate',
  async execute(message) {


    // Skip bots
    if (message.author.bot) return;

    // Skip if no guild
    if (!message.guild) return;

    // Process adore mentions first (highest priority)
    await processAdoreMention(message);

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
        const guildCache = require('../../database/cache/models/guild');
        const countingData = await guildCache.getCounting(message.guild.id);

        if (message.channel.id === countingData.channelId) {
            const num = parseInt(message.content);

            if (isNaN(num)) {
                return message.delete();
            }

            if (num === countingData.currentCount + 1 && message.author.id !== countingData.lastCounterId) {
                countingData.currentCount++;
                countingData.lastCounterId = message.author.id;
                await guildCache.setCounting(message.guild.id, countingData);
                message.react('✅');
            } else {
                message.delete();
                const warning = await message.channel.send(`${message.author}, you broke the count! The next number was ${countingData.currentCount + 1}.`);
                setTimeout(() => warning.delete(), 5000);
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

    const guildCache = require('../../database/cache/models/guild');

    // Get all autoreacts for this guild using cache system
    const autoreacts = await guildCache.getAutoReacts(message.guild.id);

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
              // Remove invalid emoji using cache system
              await guildCache.removeAutoReact(message.guild.id, autoreact.word);
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

    const guildCache = require('../../database/cache/models/guild');

    // Get all autoresponders for this guild using cache system
    const autoresponders = await guildCache.getAutoResponders(message.guild.id);

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
            const { EmbedVariableProcessor } = require('../../utils/embedbuilder');

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
    const botNames = ['adore', message.client.user.username.toLowerCase()];
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

    // Track the message
    const guildCache = require('../../database/cache/models/guild');
    await guildCache.trackMessage(message.guild.id, message.author.id);

  } catch (error) {
    // Silent fail for message tracking
  }
}

async function processStickyMessageActivity(message) {
  try {
    // Skip bots
    if (message.author.bot) return;

    // Update sticky message activity for this channel
    const guildCache = require('../../database/cache/models/guild');
    await guildCache.updateStickyMessageActivity(message.guild.id, message.channel.id);

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
      const guildCache = require('../../database/cache/models/guild');

      // Add each detected swear to the database
      for (const swear of foundSwears) {
        await guildCache.addSwear(message.guild.id, message.author.id, swear);
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

// Process adore mentions
async function processAdoreMention(message) {
  try {
    // Check if message starts with "adore" (case insensitive)
    const content = message.content.toLowerCase();
    if (content.startsWith('adore ')) {
      const { handleAdoreMention } = require('../../commands/utility/responder');
      await handleAdoreMention(message.client, message);
    }
  } catch (error) {
    // Silent fail for adore mention processing
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
    const prefixCache = require('../../database/cache/models/prefix');
    const guildPrefix = await prefixCache.getGuildPrefix(message.guild.id);
    if (message.content.startsWith(guildPrefix)) return;

    const guildCache = require('../../database/cache/models/guild');

    // Check if level system is enabled
    const isEnabled = await guildCache.isLevelSystemEnabled(message.guild.id);
    if (!isEnabled) return;

    // Get user's current level data
    const userData = await guildCache.getUserLevel(message.guild.id, message.author.id);

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

    // Add XP and check for level up
    const result = await guildCache.addUserExperience(message.guild.id, message.author.id, xpGain);

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
    const guildCache = require('../../database/cache/models/guild');
    const { EmbedBuilder } = require('discord.js');
    const { colors, emojis } = require('../../config/setup');

    // Get message mode
    const messageMode = await guildCache.getLevelMessageMode(message.guild.id);

    if (messageMode === 'none') return; // Level up messages disabled

    // Create level up embed
    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`**${message.member?.displayName || message.author.username}** had **leveled up**!\n> They are now **level ${newLevel}**, yayyyyy`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

    // Determine where to send the message
    let targetChannel = message.channel; // Default to context

    if (messageMode === 'channel') {
      const levelUpChannelId = await guildCache.getLevelUpChannel(message.guild.id);
      if (levelUpChannelId) {
        const levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
        if (levelUpChannel) {
          targetChannel = levelUpChannel;
        }
      }
    }

    // Send level up message
    await targetChannel.send({ embeds: [embed] });

    // Check and assign level roles
    await assignLevelRoles(message, newLevel);

  } catch (error) {
    // Silent fail for level up message
  }
}

// Assign level roles when user levels up
async function assignLevelRoles(message, newLevel) {
  try {
    const guildCache = require('../../database/cache/models/guild');

    // Get level roles
    const levelRoles = await guildCache.getLevelRoles(message.guild.id);
    if (!levelRoles || levelRoles.length === 0) return;

    // Find roles user should have based on their new level
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

  } catch (error) {
    // Silent fail for role assignment
  }
}
