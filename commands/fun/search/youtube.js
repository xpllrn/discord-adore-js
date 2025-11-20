const { ensureGuildData } = require('../../../database');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const ytsearch = require("yt-search");

module.exports = {
  name: "youtube",
  aliases: ['yt'],
  description: `search for a song/video on youtube`,
  syntax: 'youtube (query)',
  example: 'youtube never gonna give you up',
  run: async(client, message, args) => {

    await ensureGuildData(message.guild.id);

    const youtubesearch = args.join(' ');

    if (!youtubesearch) {
      return runHelpCommand(message, 'youtube');
    }

    try {
      const res = await ytsearch(youtubesearch);

      if (!res || !res.videos || res.videos.length === 0) {
        return embeds.warn(message, 'No results found for your search');
      }

      const video = res.videos[0];

      if (!video || !video.url) {
        return embeds.warn(message, 'No video found');
      }

      return message.channel.send(`||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| _ _ _ _ _ _  ${video.url}`);

    } catch (error) {
      return embeds.warn(message, 'There\'s some issue with **YouTube API**, Please try again later');
    }
  }
}
