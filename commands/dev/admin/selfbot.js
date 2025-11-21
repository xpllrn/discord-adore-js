const { hasPermissionLevel } = require('../../../utils/permissions');

// Store selfbot instance globally
let selfbotInstance = null;

module.exports = {
  name: "selfbot",
  aliases: ['sb'],
  description: 'Control the selfbot',
  syntax: 'selfbot <on/off>',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    const config = require('../../../config/setup');
    const action = args[0]?.toLowerCase();

    // Delete invoke command
    await message.delete().catch(() => {});

    if (action === 'on') {
      try {
        if (selfbotInstance && selfbotInstance.enabled) {
          return await message.channel.send('ok');
        }

        // Start selfbot
        if (!selfbotInstance) {
          const SelfBot = require('../../../deman/index.js');
          selfbotInstance = new SelfBot();
          await selfbotInstance.start();
        } else {
          selfbotInstance.setEnabled(true);
        }

        await message.channel.send('ok');
      } catch (error) {
        console.error('[SELFBOT] Start error:', error.message);
        await message.channel.send('no');
      }
    } else if (action === 'off') {
      try {
        if (!selfbotInstance || !selfbotInstance.enabled) {
          return await message.channel.send('no');
        }

        selfbotInstance.setEnabled(false);
        await message.channel.send('ok');
      } catch (error) {
        console.error('[SELFBOT] Stop error:', error.message);
        await message.channel.send('no');
      }
    } else {
      await message.channel.send('no');
    }
  }
};
