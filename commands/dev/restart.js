const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = {
  name: "restart",
  aliases: ['reboot'],
  description: 'restart your mom',
  syntax: 'bozo u can not use it',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    try {
      await message.channel.send('rebooting **vleed** in a sec master...');
      
      // Give time for message to send
      setTimeout(async () => {
        try {
          await execAsync('pm2 restart vleed');
        } catch (error) {
          console.error('Failed to restart via PM2:', error.message);
          // Fallback: exit process (PM2 will restart automatically)
          process.exit(0);
        }
      }, 1000);
      
    } catch (error) {
      return message.channel.send('I **failed** master, I am sorry');
    }
  }
};
