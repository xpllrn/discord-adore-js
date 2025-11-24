const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  name: "latency",
  aliases: ['ms', 'ping'],
  description: `Shows bot's latency response times`,
  syntax: 'latency',
  example: 'latency',
  global: true,
  run: async (client, message, args) => {

    const targets = ['no one', 'everyone', 'ur mom', 'horny asian women', 'horny asian man', 'vee', 'sin', '4 dick in jon'];
    const randomTarget = targets[Math.floor(Math.random() * targets.length)];

    try {
      const startTime = Date.now();
      const msg = await message.channel.send("latency...");
      const endTime = Date.now();

      const messageLatency = endTime - startTime;
      const apiLatency = Math.round(client.ws.ping);

      // Check if edit method exists (for testing compatibility)
      if (msg && typeof msg.edit === 'function') {
        await msg.edit(`it took \`\`${messageLatency}ms\`\` to **ping ${randomTarget}** (edit: \`\`${apiLatency}ms\`\`)`);
      } else {
        // Fallback for testing environments
        await message.channel.send(`it took \`\`${messageLatency}ms\`\` to **ping ${randomTarget}** (edit: \`\`${apiLatency}ms\`\`)`);
      }

    } catch (error) {
      // Simple fallback if everything fails
      const fallbackLatency = Date.now() - message.createdTimestamp;
      await message.channel.send(`🏓 **Pong!** \`${fallbackLatency}ms\``);
    }
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('latency')
    .setDescription("Shows bot's latency response times"),

  execute: async (interaction) => {
    const targets = ['no one', 'everyone', 'ur mom', 'horny asian women', 'horny asian man', 'vee', 'sin', '4 dick in jon'];
    const randomTarget = targets[Math.floor(Math.random() * targets.length)];

    try {
      const startTime = Date.now();
      await interaction.reply("latency...");
      const endTime = Date.now();

      const messageLatency = endTime - startTime;
      const apiLatency = Math.round(interaction.client.ws.ping);

      await interaction.editReply(`it took \`\`${messageLatency}ms\`\` to **ping ${randomTarget}** (edit: \`\`${apiLatency}ms\`\`)`);
    } catch (error) {
      const fallbackLatency = Date.now() - interaction.createdTimestamp;
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(`🏓 **Pong!** \`${fallbackLatency}ms\``);
      } else {
        await interaction.reply(`🏓 **Pong!** \`${fallbackLatency}ms\``);
      }
    }
  }
}