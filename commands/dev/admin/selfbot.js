const { hasPermissionLevel } = require('../../../utils/permissions');
const logger = require('../../../utils/logger');

module.exports = {
  name: "selfbot",
  aliases: ['sb'],
  description: 'Control the selfbot',
  syntax: 'selfbot <on/off>',
  permission: 'dev',
  run: async (client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    const action = args[0]?.toLowerCase();

    // Delete invoke command
    await message.delete().catch(() => {});

    if (action === 'on') {
      try {
        const selfbotInstance = global.selfbotInstance;
        
        if (selfbotInstance && selfbotInstance.enabled) {
          return await message.channel.send('ok');
        }

        // Start selfbot
        if (!selfbotInstance) {
          const SelfBot = require('../../../deman/index.js');
          const newInstance = new SelfBot();
          await newInstance.start();
          global.selfbotInstance = newInstance;
        } else {
          selfbotInstance.setEnabled(true);
        }

        await message.channel.send('ok');
      } catch (error) {
        logger.webhook.error(error, message);
        await message.channel.send('no');
      }
    } else if (action === 'off') {
      try {
        const selfbotInstance = global.selfbotInstance;
        
        if (!selfbotInstance || !selfbotInstance.enabled) {
          return await message.channel.send('no');
        }

        selfbotInstance.setEnabled(false);
        await message.channel.send('ok');
      } catch (error) {
        logger.webhook.error(error, message);
        await message.channel.send('no');
      }
    } else {
      await message.channel.send('no');
    }
  }
};
