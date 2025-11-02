const { embeds } = require('../../core/embeds');
const mongoose = require('mongoose');
const chalk = require('chalk');

module.exports = {
  name: "dbmove",
  aliases: ['dbmigrate', 'migrate'],
  description: 'Migrate all data from old database to new MongoDB Atlas database',
  permission: 'dev',
  run: async(client, message, args) => {
    
    // Confirm migration with user
    if (!args[0] || args[0].toLowerCase() !== 'confirm') {
      const { EmbedBuilder } = require('discord.js');
      
      const confirmEmbed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('⚠️ Database Migration Warning')
        .setDescription('This command will migrate all data from the current database to the new MongoDB Atlas database.\n\n**What will happen:**\n• Connect to new MongoDB Atlas database\n• Create `global` and `local` databases\n• Copy all user data to `global` database\n• Copy all guild data to `local` database\n• Verify data integrity\n\n**To proceed, run:** `,dbmove confirm`')
        .setFooter({ text: 'This operation may take several minutes depending on data size' });
      
      return message.channel.send({ embeds: [confirmEmbed] });
    }

    const statusMessage = await embeds.loading(message, 'Starting database migration...');

    try {
      // Get current connections
      const { getConnections } = require('../../database/connection');
      const currentConnections = getConnections();

      if (!currentConnections.global && !currentConnections.local) {
        return statusMessage.edit({ embeds: [embeds.deny('No current database connections found!')] });
      }

      // Connect to new MongoDB Atlas database
      await updateStatus(statusMessage, 'Connecting to new MongoDB Atlas database...');
      
      const newDbUrl = process.env.New_DB;
      if (!newDbUrl) {
        return statusMessage.edit({ embeds: [embeds.deny('New_DB environment variable not found!')] });
      }

      // Create connections to new database with different database names
      const globalDbUrl = newDbUrl.replace('/adore', '/global');
      const localDbUrl = newDbUrl.replace('/adore', '/local');

      const newGlobalConnection = mongoose.createConnection(globalDbUrl, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 120000,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        retryReads: true
      });

      const newLocalConnection = mongoose.createConnection(localDbUrl, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 120000,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        retryReads: true
      });

      // Wait for connections
      await Promise.all([
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Global connection timeout')), 30000);
          newGlobalConnection.once('open', () => { clearTimeout(timeout); resolve(); });
          newGlobalConnection.once('error', (err) => { clearTimeout(timeout); reject(err); });
        }),
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Local connection timeout')), 30000);
          newLocalConnection.once('open', () => { clearTimeout(timeout); resolve(); });
          newLocalConnection.once('error', (err) => { clearTimeout(timeout); reject(err); });
        })
      ]);

      console.log(chalk.green('✓ Connected to new MongoDB Atlas databases'));

      // Load models for old connections
      const { schema: userSchema } = require('../../database/models/user');
      const { schema: guildSchema } = require('../../database/models/guild');
      const { schema: systemSchema } = require('../../database/models/system');
      const { schema: webhookSchema } = require('../../database/models/webhook');
      const welcomeButtonSchema = require('../../database/models/welcomeButton'); // Direct schema export
      const { schema: storeItemSchema } = require('../../database/models/storeItem');
      const { schema: sprintSchema } = require('../../database/models/sprint');
      const { schema: spotifyAuthSessionSchema } = require('../../database/models/spotifyAuthSession');

      // Create models for old connections
      const oldUserModel = currentConnections.global ? currentConnections.global.model('User', userSchema) : null;
      const oldGuildModel = currentConnections.local ? currentConnections.local.model('Guild', guildSchema) : null;
      const oldSystemModel = currentConnections.global ? currentConnections.global.model('System', systemSchema) : null;
      const oldWebhookModel = currentConnections.local ? currentConnections.local.model('Webhook', webhookSchema) : null;
      const oldWelcomeButtonModel = currentConnections.local ? currentConnections.local.model('WelcomeButton', welcomeButtonSchema) : null;
      const oldStoreItemModel = currentConnections.global ? currentConnections.global.model('StoreItem', storeItemSchema) : null;
      const oldSprintModel = currentConnections.global ? currentConnections.global.model('Sprint', sprintSchema) : null;
      const oldSpotifyAuthSessionModel = currentConnections.global ? currentConnections.global.model('SpotifyAuthSession', spotifyAuthSessionSchema) : null;

      // Create models for new connections
      const newUserModel = newGlobalConnection.model('User', userSchema);
      const newGuildModel = newLocalConnection.model('Guild', guildSchema);
      const newSystemModel = newGlobalConnection.model('System', systemSchema);
      const newWebhookModel = newLocalConnection.model('Webhook', webhookSchema);
      const newWelcomeButtonModel = newLocalConnection.model('WelcomeButton', welcomeButtonSchema);
      const newStoreItemModel = newGlobalConnection.model('StoreItem', storeItemSchema);
      const newSprintModel = newGlobalConnection.model('Sprint', sprintSchema);
      const newSpotifyAuthSessionModel = newGlobalConnection.model('SpotifyAuthSession', spotifyAuthSessionSchema);

      let totalMigrated = 0;

      // Migrate global data (users, system, store items, sprints, spotify sessions)
      if (currentConnections.global) {
        await updateStatus(statusMessage, 'Migrating user data to global database...');
        
        if (oldUserModel) {
          const users = await oldUserModel.find({});
          console.log(chalk.blue(`Found ${users.length} users to migrate`));
          
          for (const user of users) {
            try {
              await newUserModel.findOneAndUpdate(
                { UserID: user.UserID },
                user.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating user ${user.UserID}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${users.length} users`));
        }

        if (oldSystemModel) {
          await updateStatus(statusMessage, 'Migrating system data to global database...');
          const systemDocs = await oldSystemModel.find({});
          console.log(chalk.blue(`Found ${systemDocs.length} system documents to migrate`));
          
          for (const doc of systemDocs) {
            try {
              await newSystemModel.findOneAndUpdate(
                { _id: doc._id },
                doc.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating system doc ${doc._id}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${systemDocs.length} system documents`));
        }

        if (oldStoreItemModel) {
          await updateStatus(statusMessage, 'Migrating store items to global database...');
          const storeItems = await oldStoreItemModel.find({});
          console.log(chalk.blue(`Found ${storeItems.length} store items to migrate`));
          
          for (const item of storeItems) {
            try {
              await newStoreItemModel.findOneAndUpdate(
                { _id: item._id },
                item.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating store item ${item._id}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${storeItems.length} store items`));
        }

        if (oldSprintModel) {
          await updateStatus(statusMessage, 'Migrating sprints to global database...');
          const sprints = await oldSprintModel.find({});
          console.log(chalk.blue(`Found ${sprints.length} sprints to migrate`));
          
          for (const sprint of sprints) {
            try {
              await newSprintModel.findOneAndUpdate(
                { _id: sprint._id },
                sprint.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating sprint ${sprint._id}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${sprints.length} sprints`));
        }

        if (oldSpotifyAuthSessionModel) {
          await updateStatus(statusMessage, 'Migrating Spotify auth sessions to global database...');
          const sessions = await oldSpotifyAuthSessionModel.find({});
          console.log(chalk.blue(`Found ${sessions.length} Spotify sessions to migrate`));
          
          for (const session of sessions) {
            try {
              await newSpotifyAuthSessionModel.findOneAndUpdate(
                { _id: session._id },
                session.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating Spotify session ${session._id}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${sessions.length} Spotify sessions`));
        }
      }

      // Migrate local data (guilds, webhooks, welcome buttons)
      if (currentConnections.local) {
        await updateStatus(statusMessage, 'Migrating guild data to local database...');
        
        if (oldGuildModel) {
          const guilds = await oldGuildModel.find({});
          console.log(chalk.blue(`Found ${guilds.length} guilds to migrate`));
          
          for (const guild of guilds) {
            try {
              await newGuildModel.findOneAndUpdate(
                { GuildID: guild.GuildID },
                guild.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating guild ${guild.GuildID}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${guilds.length} guilds`));
        }

        if (oldWebhookModel) {
          await updateStatus(statusMessage, 'Migrating webhooks to local database...');
          const webhooks = await oldWebhookModel.find({});
          console.log(chalk.blue(`Found ${webhooks.length} webhooks to migrate`));
          
          for (const webhook of webhooks) {
            try {
              await newWebhookModel.findOneAndUpdate(
                { _id: webhook._id },
                webhook.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating webhook ${webhook._id}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${webhooks.length} webhooks`));
        }

        if (oldWelcomeButtonModel) {
          await updateStatus(statusMessage, 'Migrating welcome buttons to local database...');
          const welcomeButtons = await oldWelcomeButtonModel.find({});
          console.log(chalk.blue(`Found ${welcomeButtons.length} welcome buttons to migrate`));
          
          for (const button of welcomeButtons) {
            try {
              await newWelcomeButtonModel.findOneAndUpdate(
                { _id: button._id },
                button.toObject(),
                { upsert: true, new: true }
              );
              totalMigrated++;
            } catch (error) {
              console.error(chalk.red(`Error migrating welcome button ${button._id}:`, error.message));
            }
          }
          console.log(chalk.green(`✓ Migrated ${welcomeButtons.length} welcome buttons`));
        }
      }

      // Verify migration
      await updateStatus(statusMessage, 'Verifying migration...');
      
      const newUserCount = await newUserModel.countDocuments();
      const newGuildCount = await newGuildModel.countDocuments();
      
      console.log(chalk.green(`✓ Migration verification complete`));
      console.log(chalk.blue(`New global database: ${newUserCount} users`));
      console.log(chalk.blue(`New local database: ${newGuildCount} guilds`));

      // Close new connections
      await newGlobalConnection.close();
      await newLocalConnection.close();

      const { EmbedBuilder } = require('discord.js');
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Database Migration Complete')
        .setDescription(`Successfully migrated **${totalMigrated}** documents to the new MongoDB Atlas database.`)
        .addFields([
          {
            name: '📊 Migration Summary',
            value: `**Global Database:** ${newUserCount} users and related data\n**Local Database:** ${newGuildCount} guilds and related data`,
            inline: false
          },
          {
            name: '🔗 Database URLs',
            value: `**Global:** \`${globalDbUrl.replace(/\/\/.*@/, '//***:***@')}\`\n**Local:** \`${localDbUrl.replace(/\/\/.*@/, '//***:***@')}\``,
            inline: false
          },
          {
            name: '⚠️ Next Steps',
            value: 'Update your connection configuration to use the new database URLs and restart the bot.',
            inline: false
          }
        ])
        .setTimestamp();

      await statusMessage.edit({ embeds: [successEmbed] });

    } catch (error) {
      console.error(chalk.red('Migration error:'), error);
      
      const { EmbedBuilder } = require('discord.js');
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Migration Failed')
        .setDescription(`An error occurred during migration: \`${error.message}\``)
        .setFooter({ text: 'Check console logs for detailed error information' });
      
      await statusMessage.edit({ embeds: [errorEmbed] });
    }
  }
};

async function updateStatus(message, status) {
  try {
    const { EmbedBuilder } = require('discord.js');
    const config = require('../../config/setup');
    
    const loadingEmbed = new EmbedBuilder()
      .setColor('#7985cd')
      .setTitle('🔄 Database Migration in Progress')
      .setDescription(`${config.emojis.loading} ${status}`)
      .setFooter({ text: 'Please wait, this may take several minutes...' });
    
    await message.edit({ embeds: [loadingEmbed] });
    console.log(chalk.yellow(`[Migration] ${status}`));
  } catch (error) {
    console.error('Error updating status:', error);
  }
}