const { embeds } = require('../../core/embeds');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "dbconfig",
  aliases: ['updatedb', 'configdb'],
  description: 'Update database configuration to use new MongoDB Atlas databases',
  permission: 'dev',
  run: async(client, message, args) => {
    
    if (!args[0] || args[0].toLowerCase() !== 'update') {
      const helpEmbed = {
        color: 0x0099FF,
        title: '🔧 Database Configuration Helper',
        description: 'This command helps update your database configuration after migration.',
        fields: [
          {
            name: '📋 Current Configuration',
            value: `**Global DB:** \`${process.env.GLOBAL_CONNECTION ? process.env.GLOBAL_CONNECTION.replace(/\/\/.*@/, '//***:***@') : 'Not set'}\`\n**Local DB:** \`${process.env.LOCAL_CONNECTION ? process.env.LOCAL_CONNECTION.replace(/\/\/.*@/, '//***:***@') : 'Not set'}\`\n**New DB:** \`${process.env.New_DB ? process.env.New_DB.replace(/\/\/.*@/, '//***:***@') : 'Not set'}\``,
            inline: false
          },
          {
            name: '⚠️ What this will do',
            value: '• Update `GLOBAL_CONNECTION` to use new MongoDB Atlas global database\n• Update `LOCAL_CONNECTION` to use new MongoDB Atlas local database\n• Create backup of current .env file\n• Restart required after update',
            inline: false
          },
          {
            name: '🚀 Usage',
            value: '`,dbconfig update` - Update configuration to use new databases',
            inline: false
          }
        ],
        footer: { text: 'Make sure you have run ,dbmove confirm first!' }
      };
      
      return message.channel.send({ embeds: [helpEmbed] });
    }

    try {
      const newDbUrl = process.env.New_DB;
      if (!newDbUrl) {
        return message.channel.send({ embeds: [embeds.deny('New_DB environment variable not found! Please set it first.')] });
      }

      // Create new connection URLs
      const newGlobalUrl = newDbUrl.replace('/adore', '/global');
      const newLocalUrl = newDbUrl.replace('/adore', '/local');

      const statusMessage = await message.channel.send({ embeds: [embeds.loading('Updating database configuration...')] });

      // Read current .env file
      const envPath = path.join(process.cwd(), '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Create backup
      const backupPath = path.join(process.cwd(), `.env.backup.${Date.now()}`);
      fs.writeFileSync(backupPath, envContent);

      // Update the environment variables
      envContent = envContent.replace(
        /^GLOBAL_CONNECTION=.*$/m,
        `GLOBAL_CONNECTION=${newGlobalUrl}`
      );

      envContent = envContent.replace(
        /^LOCAL_CONNECTION=.*$/m,
        `LOCAL_CONNECTION=${newLocalUrl}`
      );

      // Write updated .env file
      fs.writeFileSync(envPath, envContent);

      const successEmbed = {
        color: 0x00FF00,
        title: '✅ Database Configuration Updated',
        description: 'Successfully updated database configuration to use new MongoDB Atlas databases.',
        fields: [
          {
            name: '🔄 Updated Configuration',
            value: `**Global DB:** \`${newGlobalUrl.replace(/\/\/.*@/, '//***:***@')}\`\n**Local DB:** \`${newLocalUrl.replace(/\/\/.*@/, '//***:***@')}\``,
            inline: false
          },
          {
            name: '💾 Backup Created',
            value: `Backup saved as: \`${path.basename(backupPath)}\``,
            inline: false
          },
          {
            name: '🔄 Next Steps',
            value: '**IMPORTANT:** Restart the bot to apply the new database configuration.\n\nThe bot will now connect to your new MongoDB Atlas databases.',
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      };

      await statusMessage.edit({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error updating database configuration:', error);
      
      const errorEmbed = {
        color: 0xFF0000,
        title: '❌ Configuration Update Failed',
        description: `An error occurred while updating the configuration: \`${error.message}\``,
        footer: { text: 'Check console logs for detailed error information' }
      };
      
      return message.channel.send({ embeds: [errorEmbed] });
    }
  }
};