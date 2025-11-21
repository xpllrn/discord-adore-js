const starboardCommand = require('../../commands/server/features/starboard');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    // Handle partial reactions
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Failed to fetch partial reaction:', error);
        return;
      }
    }

    // Skip if not in a guild
    if (!reaction.message.guild) return;

    try {
      // Process no self-react functionality
      await processNoSelfReact(reaction, user);

      // Process starboard functionality
      await processStarboard(reaction, user);

      // Process giveaway functionality
      await processGiveaway(reaction, user);

      // Process reaction role functionality
      await processReactionRole(reaction, user);
    } catch (error) {
      console.error('Error in reaction add event:', error);
    }
  },
};

async function processNoSelfReact(reaction, user) {
  try {
    // Skip if user is a bot
    if (user.bot) return;

    const { getService } = require('@services');
    const guildService = getService('guild');
    const message = reaction.message;
    const guild = message.guild;

    // Get no self-react configuration
    const guildData = await guildService.ensureGuildData(guild.id);
    const noSelfReact = guildData.NoSelfReact;

    // Skip if no self-react is not enabled
    if (!noSelfReact || !noSelfReact.enabled) return;

    // Skip if user is in bypass list
    if (noSelfReact.bypassUsers && noSelfReact.bypassUsers.includes(user.id)) return;

    // Check if user is reacting to their own message
    if (message.author.id === user.id) {
      // Remove the reaction
      try {
        await reaction.users.remove(user.id);
      } catch (error) {
        console.error('Error removing self-reaction:', error);
      }
    }
  } catch (error) {
    console.error('Error in no self-react processing:', error);
  }
}

async function processStarboard(reaction, user) {
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');
    const message = reaction.message;
    const guild = message.guild;

    // Get starboard configuration
    const starboardChannelId = await guildService.getStarboardChannel(guild.id);
    const starboardThreshold = await guildService.getStarboardThreshold(guild.id);
    const starboardEmoji = await guildService.getStarboardEmoji(guild.id);

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

    // Get the starboard channel
    const starboardChannel = guild.channels.cache.get(starboardChannelId);
    if (!starboardChannel) return;

    // Count reactions for this emoji
    const reactionCount = reaction.count;

    // Check if message already exists in starboard
    const existingStarboardMessage = await guildService.findStarboardMessage(guild.id, message.id);

    if (reactionCount >= starboardThreshold) {
      if (existingStarboardMessage) {
        // Update existing starboard message
        try {
          const starboardMessage = await starboardChannel.messages.fetch(existingStarboardMessage.starboardMessageId);

          // Update the embed with new reaction count
          const updatedEmbed = starboardCommand.createStarboardEmbed(message, reactionCount, starboardEmoji);
          const button = starboardCommand.createJumpButton(message);

          await starboardMessage.edit({
            embeds: [updatedEmbed],
            components: [button]
          });

          // Update count in database
          await guildService.updateStarboardMessageCount(guild.id, message.id, reactionCount);
        } catch (error) {
          console.error('Error updating starboard message:', error);
          // If starboard message was deleted, remove from database
          await guildService.removeStarboardMessage(guild.id, message.id);
        }
      } else {
        // Create new starboard message
        const embed = starboardCommand.createStarboardEmbed(message, reactionCount, starboardEmoji);
        const button = starboardCommand.createJumpButton(message);

        try {
          const starboardMessage = await starboardChannel.send({
            embeds: [embed],
            components: [button]
          });

          // Add to database
          await guildService.addStarboardMessage(
            guild.id,
            message.id,
            starboardMessage.id,
            message.channel.id,
            message.author.id,
            reactionCount
          );
        } catch (error) {
          console.error('Error sending starboard message:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error in starboard processing:', error);
  }
}

async function processGiveaway(reaction, user) {
  try {
    // Skip if user is a bot
    if (user.bot) return;

    const { getService } = require('@services');
    const guildService = getService('guild');
    const message = reaction.message;
    const guild = message.guild;

    // Check if this is a giveaway emoji (🎉)
    if (reaction.emoji.name !== '🎉') return;

    // Check if this message is a giveaway
    const giveaway = await guildService.getGiveawayByMessageId(guild.id, message.id);
    if (!giveaway || !giveaway.isActive) return;

    // Check if giveaway has ended
    if (new Date() >= new Date(giveaway.endTime)) {
      // Remove reaction if giveaway has ended
      try {
        await reaction.users.remove(user.id);
      } catch (error) {
        // Silent fail if can't remove reaction
      }
      return;
    }

    // Check requirements
    const member = guild.members.cache.get(user.id);
    if (!member) return;

    let eligible = true;
    let reason = '';

    // Check level requirement
    if (giveaway.requirements.level) {
      const userLevel = await guildService.getUserLevel(guild.id, user.id);
      if (!userLevel || userLevel.level < giveaway.requirements.level) {
        eligible = false;
        reason = `Level ${giveaway.requirements.level}+ required`;
      }
    }

    // Check role requirement
    if (eligible && giveaway.requirements.roleId) {
      if (!member.roles.cache.has(giveaway.requirements.roleId)) {
        eligible = false;
        const role = guild.roles.cache.get(giveaway.requirements.roleId);
        reason = `${role ? role.name : 'Required'} role needed`;
      }
    }

    if (!eligible) {
      // Remove reaction and optionally notify user
      try {
        await reaction.users.remove(user.id);

        // Send a temporary message to notify the user
        const tempMessage = await message.channel.send(`<@${user.id}>, you don't meet the requirements for this giveaway: ${reason}`);

        // Delete the message after 5 seconds
        setTimeout(async () => {
          try {
            await tempMessage.delete();
          } catch (error) {
            // Silent fail if message is already deleted
          }
        }, 5000);
      } catch (error) {
        // Silent fail if can't remove reaction or send message
      }
      return;
    }

    // User is eligible, add them to participants
    await guildService.addGiveawayParticipant(guild.id, giveaway.id, user.id);

    // Update the giveaway message footer with new participant count
    try {
      const updatedGiveaway = await guildService.getGiveaway(guild.id, giveaway.id);
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
    console.error('Error in giveaway processing:', error);
  }
}

async function processReactionRole(reaction, user) {
  try {
    // Skip if user is a bot
    if (user.bot) return;

    const { getService } = require('@services');
    const guildService = getService('guild');
    const message = reaction.message;
    const guild = message.guild;

    // Get reaction roles for this guild
    const reactionRoles = await guildService.getReactionRoles(guild.id);
    if (!reactionRoles || reactionRoles.length === 0) return;

    // Get the reaction emoji string
    const reactionEmoji = reaction.emoji.id
      ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    // Find matching reaction role
    const reactionRole = reactionRoles.find(rr => 
      rr.messageId === message.id && 
      (rr.reaction === reactionEmoji || rr.reaction === reaction.emoji.name || rr.reaction === reaction.emoji.toString())
    );

    if (!reactionRole) return;

    // Get the role
    const role = guild.roles.cache.get(reactionRole.roleId);
    if (!role) {
      // Role doesn't exist anymore, remove from database
      await guildService.removeReactionRole(guild.id, message.id, reactionRole.reaction);
      return;
    }

    // Get the member
    const member = guild.members.cache.get(user.id);
    if (!member) return;

    // Check if member already has the role
    if (member.roles.cache.has(role.id)) return;

    // Add the role
    try {
      await member.roles.add(role, 'Reaction role');
    } catch (error) {
      console.error('Error adding reaction role:', error);
      // Could be due to role hierarchy or permissions
    }

  } catch (error) {
    console.error('Error in reaction role processing:', error);
  }
}