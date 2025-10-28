module.exports = {
  name: "latency",
  aliases: ['ms', 'ping'],
  description: `Shows adore's latency response times`,
  syntax: 'latency',
  example: 'latency',
  run: async (client, message, args) => {

    const targets = ['no one', 'everyone', 'ur mom', 'horny asian women', 'horny asian man', 'iPhone'];
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
  }
}