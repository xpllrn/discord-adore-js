// Reminder check handler - runs every minute to check for triggered reminders

// Import required modules at the top level
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/setup');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    // Set up reminder checking
    setupReminderCheck(client);
  }
};

// Track last error to prevent spam
let lastErrorTime = 0;
const ERROR_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function setupReminderCheck(client) {
  // Run reminder check every minute (60000 ms)
  setInterval(async () => {
    await checkReminders(client);
  }, 60000); // 1 minute

  // Also run immediately on startup (after 30 seconds to allow database to connect)
  setTimeout(() => checkReminders(client), 30000);
}

async function checkReminders(client) {
  try {
    const userCache = require('../../database/cache/models/user');
    const { getModels, isDatabaseReady } = require('../../database');

    // Check if database is ready
    const dbStatus = isDatabaseReady();
    if (!dbStatus.global && !dbStatus.local && !dbStatus.legacy) {
      console.log('Database not ready for reminder check, skipping...');
      return;
    }

    // Get models for direct database access when needed
    const models = getModels();
    if (!models || !models.User) {
      console.log('User model not available for reminder check, skipping...');
      return;
    }

    // Get all users who have reminders with timeout
    const usersWithReminders = await models.User.find({
      'Reminders.0': { $exists: true }
    }).select('UserID Reminders').maxTimeMS(5000); // 5 second timeout

    // Check if we got valid data
    if (!usersWithReminders || usersWithReminders.length === 0) {
      return; // No reminders to process
    }

    for (const userData of usersWithReminders) {
      try {
        // Validate userData
        if (!userData || !userData.UserID) {
          continue; // Skip invalid user data
        }

        const userId = userData.UserID;

        // Get reminders from cache (this will auto-fetch from DB if not in cache)
        const reminders = await userCache.getReminders(userId);

        // Check each reminder
        for (const reminder of reminders) {
          // Validate reminder object
          if (!reminder || !reminder.nextTrigger || !reminder.content) {
            continue; // Skip invalid reminder
          }
          const now = new Date();

          if (reminder.nextTrigger <= now) {
            // Reminder is triggered, send DM
            try {
              const user = await client.users.fetch(userId);
              if (user) {
                // Create embed
                const embed = new EmbedBuilder()
                  .setColor(config.colors.embed)
                  .setTitle('⏰ Reminder')
                  .setDescription(`You wanted me to remind you to: **${reminder.content}**`)
                  .setTimestamp(reminder.createdAt);

                // Create components array
                const components = [];

                // Add message button if we have a message URL
                if (reminder.messageUrl) {
                  const row = new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setLabel('Message')
                        .setStyle(ButtonStyle.Link)
                        .setURL(reminder.messageUrl)
                    );
                  components.push(row);
                }

                // Send the reminder
                await user.send({
                  embeds: [embed],
                  components: components
                });

                // Ensure cache writes are enabled before updating
                const { getCacheManager } = require('../../database/cache/core/CacheManager');
                const cacheManager = getCacheManager();
                if (!cacheManager.userCache.areWritesEnabled()) {
                  cacheManager.enableWrites();
                }

                if (reminder.isDaily) {
                  // Update next trigger for daily reminder
                  const nextTrigger = new Date(now.getTime() + reminder.duration);
                  await userCache.updateReminderNextTrigger(userId, reminder.id, nextTrigger);
                } else {
                  // Remove one-time reminder
                  await userCache.removeReminder(userId, reminder.id);
                }
              }
            } catch (dmError) {
              // If we can't send DM (user has DMs disabled, blocked bot, etc.)
              // Remove the reminder to prevent spam attempts
              await userCache.removeReminder(userId, reminder.id);
            }
          }
        }
      } catch (userError) {
        // Silent fail for individual user processing
        console.error(`Error processing reminders for user ${userData.UserID}:`, userError);
      }
    }
  } catch (error) {
    // Only log errors if we haven't logged recently (prevent spam)
    const now = Date.now();
    if (now - lastErrorTime > ERROR_COOLDOWN) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Reminder Check System', {
          command: 'Reminder Check',
          args: 'System Check'
        });
      }
      lastErrorTime = now;
    }
  }
}
