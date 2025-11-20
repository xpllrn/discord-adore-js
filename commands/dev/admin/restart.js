const { hasPermissionLevel } = require('../../../utils/permissions');
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
      const { EmbedBuilder } = require('discord.js');
      const config = require('../../../config/setup');
      
      // Create initial embed
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setDescription('```\n[░░░░░░░░░░░░░░░░░░░░] 0% Initializing restart... ```');
      
      const msg = await message.channel.send({ embeds: [embed] });
      
      // Update progress (safe rate: 1 edit per 2 seconds)
      const steps = [
        { progress: 20, text: 'saving state...' },
        { progress: 40, text: 'closing connections...' },
        { progress: 101, text: 'cya, adore is coming back up...' },
      ];
      
      let currentStep = 0;
      const updateInterval = setInterval(async () => {
        if (currentStep >= steps.length) {
          clearInterval(updateInterval);
          return;
        }
        
        const step = steps[currentStep];
        const filled = Math.floor(20 * (step.progress / 100));
        const empty = 20 - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        
        embed.setDescription(`\`\`\`\n[${bar}] ${step.progress}% ${step.text}\n\`\`\``);
        
        try {
          await msg.edit({ embeds: [embed] });
        } catch (error) {
          // Ignore rate limit errors
        }
        
        currentStep++;
        
        // Trigger restart at 60%
        if (step.progress === 60) {
          setTimeout(async () => {
            try {
              await execAsync('pm2 restart adore');
            } catch (error) {
              console.error('Failed to restart via PM2:', error.message);
              process.exit(0);
            }
          }, 500);
        }
      }, 1500); // Update every 1.5 seconds (safe for rate limits)
      
    } catch (error) {
      return message.channel.send('I **failed** master, I am sorry');
    }
  }
};
