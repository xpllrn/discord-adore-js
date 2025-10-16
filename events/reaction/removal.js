const snipeCache = require('../../database/cache/snipe');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    // Add to reaction snipe cache
    snipeCache.addRemovedReaction(reaction, user);

    // Skip if not in a guild
    if (!reaction.message.guild) return;

    try {
      // Process starboard functionality
      await processStarboardRemoval(reaction, user);

      // Process giveaway functionality
      await processGiveawayRemoval(reaction, user);
    } catch (error) {
      console.error('Error in reaction remove event:', error);
    }
  },
};

async function processStarboardRemoval(reaction, user) {
  try {
    const guildCache = require('../../database/cache/models/guild');
    const message = reaction.message;
    const guild = message.guild;

    // Get starboard configuration
    const starboardChannelId = await guildCache.getStarboardChannel(guild.id);
    const starboardEmoji = await guildCache.getStarboardEmoji(guild.id);

    // Skip if starboard is not configured
    if (!starboardChannelId) return;

    // Skip if this isn't the starboard emoji
    const reactionEmoji = reaction.emoji.id
      ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    // Check for emoji match with multiple methods
    const emojiMatch = reactionEmoji === starboardEmoji ||
                      (reaction.emoji.name === starboardEmoji) ||
                      (reaction.emoji.toString() === starboardEmoji);

    if (!emojiMatch) return;

    // Check if message exists in starboard
    const existingStarboardMessage = await guildCache.findStarboardMessage(guild.id, message.id);
    if (!existingStarboardMessage) return;

    // Get the starboard channel
    const starboardChannel = guild.channels.cache.get(starboardChannelId);
    if (!starboardChannel) return;

    // Count reactions for this emoji
    const reactionCount = reaction.count;

    try {
      const starboardMessage = await starboardChannel.messages.fetch(existingStarboardMessage.starboardMessageId);

      if (reactionCount === 0) {
        // Remove starboard message if no reactions left
        await starboardMessage.delete();
        await guildCache.removeStarboardMessage(guild.id, message.id);
      } else {
        // Update the embed with new reaction count
        const starboardCommand = require('../../commands/server/starboard');
        const updatedEmbed = starboardCommand.createStarboardEmbed(message, reactionCount, starboardEmoji);
        const button = starboardCommand.createJumpButton(message);

        await starboardMessage.edit({
          embeds: [updatedEmbed],
          components: [button]
        });

        // Update count in database
        await guildCache.updateStarboardMessageCount(guild.id, message.id, reactionCount);
      }
    } catch (error) {
      // If starboard message was deleted, remove from database
      await guildCache.removeStarboardMessage(guild.id, message.id);
    }
  } catch (error) {
    console.error('Error in starboard removal processing:', error);
  }
}

async function processGiveawayRemoval(reaction, user) {
  try {
    // Skip if user is a bot
    if (user.bot) return;

    const guildCache = require('../../database/cache/models/guild');
    const message = reaction.message;
    const guild = message.guild;

    // Check if this is a giveaway emoji (🎉)
    if (reaction.emoji.name !== '🎉') return;

    // Check if this message is a giveaway
    const giveaway = await guildCache.getGiveawayByMessageId(guild.id, message.id);
    if (!giveaway || !giveaway.isActive) return;

    // Remove user from participants
    await guildCache.removeGiveawayParticipant(guild.id, giveaway.id, user.id);

    // Update the giveaway message footer with new participant count
    try {
      const updatedGiveaway = await guildCache.getGiveaway(guild.id, giveaway.id);
      if (updatedGiveaway) {
        const embed = message.embeds[0];
        if (embed) {
          const { EmbedBuilder } = require('discord.js');
          const newEmbed = new EmbedBuilder(embed.data)
            .setFooter({ text: `${updatedGiveaway.participants.length} participants` });

          await message.edit({ embeds: [newEmbed] });
        }
      }
    } catch (error) {
      // Silent fail if can't update message
    }

  } catch (error) {
    console.error('Error in giveaway removal processing:', error);
  }
}
