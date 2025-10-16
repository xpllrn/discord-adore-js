// Sticky message check handler - runs every minute to check for inactive channels

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    // Set up sticky message checking
    setupStickyMessageCheck(client);
  }
};

// Track last error to prevent spam
let lastErrorTime = 0;
const ERROR_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function setupStickyMessageCheck(client) {
  // Run sticky message check every minute (60000 ms)
  setInterval(async () => {
    await checkStickyMessages(client);
  }, 60000); // 1 minute

  // Also run immediately on startup (after 30 seconds to allow database to connect)
  setTimeout(() => checkStickyMessages(client), 30000);
}

async function checkStickyMessages(client) {
  try {
    const { getModels, isDatabaseReady } = require('../../database');
    const guildCache = require('../../database/cache/models/guild');
    const { EmbedVariableProcessor } = require('../../utils/embedbuilder');

    // Check if database is ready
    if (!isDatabaseReady()) {
      return; // Database not ready, skip this check
    }

    // Get models safely
    const models = getModels();
    if (!models || !models.Guild) {
      return; // Models not available, skip this check
    }

    // Get all guilds that have sticky messages
    const guildsWithStickyMessages = await models.Guild.find({
      'StickyMessages': { 
        $exists: true, 
        $not: { $size: 0 } 
      }
    }).select('GuildID StickyMessages').maxTimeMS(5000); // 5 second timeout

    // Check if we got valid data
    if (!guildsWithStickyMessages || guildsWithStickyMessages.length === 0) {
      return; // No sticky messages to process
    }

    for (const guildData of guildsWithStickyMessages) {
      try {
        // Validate guildData
        if (!guildData || !guildData.GuildID) {
          continue; // Skip invalid guild data
        }

        const guildId = guildData.GuildID;
        const guild = client.guilds.cache.get(guildId);
        
        if (!guild) {
          continue; // Skip if bot is not in guild
        }

        // Get inactive sticky messages for this guild (15 minutes of inactivity)
        const inactiveStickyMessages = await guildCache.getInactiveStickyMessages(guildId, 15);

        for (const stickyMessage of inactiveStickyMessages) {
          try {
            // Get the channel
            const channel = guild.channels.cache.get(stickyMessage.channelId);
            if (!channel) {
              // Channel not found, remove sticky message
              await guildCache.removeStickyMessage(guildId, stickyMessage.channelId);
              continue;
            }

            // Check if bot has permission to send messages
            if (!channel.permissionsFor(guild.members.me).has('SendMessages')) {
              continue; // Skip if no permission
            }

            // Check if the last message in the channel is the sticky message
            let shouldSendSticky = true;
            try {
              const lastMessages = await channel.messages.fetch({ limit: 1 });
              const lastMessage = lastMessages.first();
              
              if (lastMessage && lastMessage.id === stickyMessage.lastStickyMessageId) {
                // Last message is already the sticky message, don't send again
                shouldSendSticky = false;
              }
            } catch (error) {
              // If we can't fetch messages, still try to send sticky
            }

            if (shouldSendSticky) {
              // Delete the previous sticky message if it exists
              if (stickyMessage.lastStickyMessageId) {
                try {
                  const oldStickyMessage = await channel.messages.fetch(stickyMessage.lastStickyMessageId);
                  if (oldStickyMessage && oldStickyMessage.author.id === client.user.id) {
                    await oldStickyMessage.delete();
                  }
                } catch (error) {
                  // Old message might already be deleted, continue
                }
              }

              // Send the sticky message
              try {
                const variables = {
                  guild: guild,
                  channel: channel
                };

                let sentMessage;
                if (stickyMessage.message.trim().startsWith('{embed}')) {
                  // Use EmbedVariableProcessor for embed messages
                  sentMessage = await EmbedVariableProcessor.process(channel, stickyMessage.message, variables);
                } else {
                  // Regular text message
                  const processedMessage = EmbedVariableProcessor.replaceVariables(stickyMessage.message, variables);
                  sentMessage = await channel.send({ content: processedMessage });
                }

                // Update the sticky message ID and reset activity timer
                if (sentMessage && sentMessage.id) {
                  await guildCache.updateStickyMessageId(guildId, stickyMessage.channelId, sentMessage.id);
                  await guildCache.updateStickyMessageActivity(guildId, stickyMessage.channelId);
                }

              } catch (sendError) {
                console.error(`Error sending sticky message in channel ${stickyMessage.channelId}:`, sendError);
              }
            }

          } catch (stickyError) {
            console.error(`Error processing sticky message for channel ${stickyMessage.channelId}:`, stickyError);
          }
        }

      } catch (guildError) {
        console.error(`Error processing sticky messages for guild ${guildData.GuildID}:`, guildError);
      }
    }

  } catch (error) {
    // Only log errors if we haven't logged one recently (prevent spam)
    const now = Date.now();
    if (now - lastErrorTime > ERROR_COOLDOWN) {
      console.error('Error in sticky message check:', error);
      lastErrorTime = now;
    }
  }
}
