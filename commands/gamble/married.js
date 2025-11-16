const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../../handlers/finder');
const { colors } = require('../../config/setup');
const logger = require('../../utils/logger');

module.exports = {
  name: "married",
  aliases: ['marriage'],
  description: 'Check marriage status and duration',
  syntax: 'married [user]',
  example: 'married @vwsn',
  run: async (client, message, args) => {
    
    let targetUser = message.author;
    
    // If user specified someone else
    if (args[0]) {
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }

      targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    }

    try {
      const userService = getService('user');

      // Get marriage data
      const userData = await userService.get(targetUser.id);
      const marriage = userData?.Marriage;

      if (!marriage || !marriage.partnerId) {
        const isOwnStatus = targetUser.id === message.author.id;
        const userText = isOwnStatus ? 'You are' : `**${targetUser.username}** is`;
        return embeds.warn(message, `${userText} not married to anyone!`);
      }

      // Get partner data
      const partner = await client.users.fetch(marriage.partnerId).catch(() => null);
      if (!partner) {
        return embeds.deny(message, 'Could not find marriage partner data.');
      }

      // Calculate marriage duration
      const marriedAt = new Date(marriage.marriedAt);
      const now = new Date();
      const durationMs = now - marriedAt;
      const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      // Get ring info
      let ringName = 'Unknown Ring';
      if (marriage.ringId) {
        const storeService = getService('store');
        const ring = await storeService.getItemById(marriage.ringId);
        if (ring) {
          ringName = ring.name;
        }
      }

      // Format timestamp
      const timestamp = `<t:${Math.floor(marriedAt.getTime() / 1000)}:R>`;

      const description = `💍 <@${targetUser.id}> and <@${partner.id}> are happily married with **${ringName}** from ${timestamp}`;

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(description);

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'Not sure if you are married or cheating');
    }
  }
};
