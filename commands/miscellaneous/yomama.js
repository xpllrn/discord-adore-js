const fetch = require('node-fetch');
const { embeds } = require('../../core/embeds');

module.exports = {
  name: "yomama",
  aliases: ['ym', 'yomomma'],
  description: `sends a random yo mama joke`,
  syntax: 'yomama (user)',
  example: 'yomama @vwsn',
  run: async (client, message, args) => {

    try {
      const res = await fetch('https://www.yomama-jokes.com/api/v1/jokes/random/');

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();

      if (data.joke) {
        message.channel.send({ content: data.joke });
      } else {
        return embeds.warn(message, 'Failed to get a joke. Try again later.');
      }
    } catch (error) {
      return embeds.warn(message, 'Failed to get a joke. Try again later.');
    }
  }
}
