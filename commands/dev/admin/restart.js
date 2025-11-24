const { hasPermissionLevel } = require('../../../utils/permissions');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = {
  name: "restart",
  aliases: ['reboot'],
  description: 'restart your mom',
  syntax: 'bozo u can not use it',
  permission: 'developer',
  run: async (client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    try {
      const config = require('../../../config/setup');
      await message.react(config.emojis.success);
      await execAsync('pm2 restart adore');
    } catch (error) {
      console.error('Failed to restart via PM2:', error.message);
      process.exit(0);
    }
  }
};
