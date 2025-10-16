const fetch = require('node-fetch');
const { embeds } = require('../../core/embeds');

module.exports = {
  name: "advice",
  description: `sends a random piece of advice`,
  usage: `{guildprefix}advice`,
  run: async(client, message, args) => {

    try {
      const res = await fetch('https://api.adviceslip.com/advice');

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();

      const advice = data?.slip?.advice;
      if (advice) {
        message.channel.send({ content: advice });
      } else {
        return embeds.warn(message, 'Failed to get advice. Try again later.');
      }
    } catch (error) {
      return embeds.warn(message, 'Failed to get advice. Try again later.');
    }
  }
}
