const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../../config/setup');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../../../handlers/finder');
const { isNSFWChannel, getOrdinal } = require('../../../utils/helpers');

module.exports = {
  name: "threesome",
  description: "`NSFW` threesome roleplay command.",
  syntax: 'threesome @user1 @user2',
  example: 'threesome @vee @josh',
  run: async (client, message, args) => {
    try {
      // Get guild data to check for NSFW bypass
      const guildService = getService('guild');
      const guildData = await guildService.ensureGuildData(message.guild.id);
      
      // Check if channel is NSFW or bypass is enabled
      if (!isNSFWChannel(message.channel, guildData)) {
        return embeds.deny(message, 'This command can only be used in `NSFW` channels!');
      }

      // Check if exactly 2 users are mentioned
      if (args.length !== 2) {
        return embeds.warn(message, 'You need to mention **2 users** for a threesome!');
      }

      // Find both users
      const userResult1 = await findUser(message.guild, args[0], client);
      if (!userResult1.found || !userResult1.user) {
        return embeds.deny(message, userResult1.error || 'First user not found!');
      }

      const userResult2 = await findUser(message.guild, args[1], client);
      if (!userResult2.found || !userResult2.user) {
        return embeds.deny(message, userResult2.error || 'Second user not found!');
      }

      const targetUser1 = userResult1.user;
      const targetUser2 = userResult2.user;

      // Get actual user objects
      const actualUser1 = targetUser1.user || targetUser1;
      const actualUser2 = targetUser2.user || targetUser2;

      // Check if trying to target the bot
      if (actualUser1.id === message.guild.members.me.id || actualUser2.id === message.guild.members.me.id) {
        return message.channel.send('Leave me alone!');
      }

      // Check if same user is mentioned twice
      if (actualUser1.id === actualUser2.id) {
        return embeds.warn(message, 'You cannot mention the same user twice!');
      }

      // Fetch GIF from Purrbot API
      const response = await fetch('https://api.purrbot.site/v2/img/nsfw/threesome_ffm/gif');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.message || 'API returned an error');
      }

      const gifUrl = data.link;

      // Get user IDs
      const targetUserId1 = actualUser1.id;
      const targetUserId2 = actualUser2.id;
      const userService = getService('user');

      // Track interactions for both users
      const count1 = await userService.trackRoleplayInteraction(
        message.author.id,
        targetUserId1,
        'threesome'
      );

      const count2 = await userService.trackRoleplayInteraction(
        message.author.id,
        targetUserId2,
        'threesome'
      );

      // Create description
      const description = `<@${message.author.id}> had a threesome with <@${targetUserId1}> and <@${targetUserId2}>! 🔥`;

      // Create and send embed
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(description)
        .setImage(gifUrl);

      // Add footer with interaction counts if relevant
      const footerParts = [];
      if (count1 > 1) {
        footerParts.push(`${getOrdinal(count1)} time with ${actualUser1.username}`);
      }
      if (count2 > 1) {
        footerParts.push(`${getOrdinal(count2)} time with ${actualUser2.username}`);
      }

      if (footerParts.length > 0) {
        embed.setFooter({ text: footerParts.join(' • ') });
      }

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.log('threesome command failed:', error.message);
      return embeds.warn(message, 'Failed to threesome! Please try again.');
    }
  }
};