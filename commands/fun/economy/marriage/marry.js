const { embeds } = require('../../../../core/embeds');
const { createConfirmation } = require('../../../../core/buttons');
const { getService } = require('@services');
const { findUser } = require('../../../../handlers/finder');
const logger = require('../../../../utils/logger');

module.exports = {
  name: "marry",
  aliases: ['propose'],
  description: 'Propose marriage to someone with a ring',
  syntax: 'marry <user> [ring]',
  example: 'marry @vwsn diamond ring',
  run: async (client, message, args) => {
    
    if (!args[0]) {
      return embeds.warn(message, 'Please **mention someone** to marry, like `marry <user> [ring]`');
    }

    // Find the target user
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    
    // Get ring identifier from remaining args (if provided)
    const ringIdentifier = args.slice(1).join(' ');

    // Prevent self-marriage
    if (targetUser.id === message.author.id) {
      return embeds.deny(message, 'You **cannot** marry yourself!');
    }

    // Check if trying to marry the bot
    if (!permissions.checkBotAction(message, targetUser)) return;

    // Prevent bot marriage
    if (targetUser.bot) {
      return embeds.deny(message, 'You **cannot marry** my brethren');
    }

    try {
      const userService = getService('user');

      // Check if author is already married
      const authorData = await userService.get(message.author.id);
      if (authorData?.Marriage?.partnerId) {
        return embeds.deny(message, 'You are **already married**! you are trying to **creat**?');
      }

      // Check if target is already married
      const targetData = await userService.get(targetUser.id);
      if (targetData?.Marriage?.partnerId) {
        return embeds.deny(message, `**${targetUser.username}** is **already married** to someone else!`);
      }

      // Check if author has a ring in inventory
      const inventory = await userService.getInventory(message.author.id);
      const rings = inventory.filter(item => item.category === 'rings');

      if (rings.length === 0) {
        return embeds.deny(message, 'You need a **ring to propose**! Buy one from the `store rings`.');
      }

      const storeService = getService('store');
      let selectedRing = null;

      // If user specified a ring, find it
      if (ringIdentifier) {
        // Try to find by ID or name
        const storeItem = await storeService.findItemByIdentifier(ringIdentifier);
        
        if (!storeItem || storeItem.category !== 'rings') {
          return embeds.deny(message, `**${ringIdentifier}** is not a valid ring. Use \`inventory\` to see your rings.`);
        }

        // Check if user has this ring in inventory
        selectedRing = rings.find(ring => ring.id === storeItem.id);
        
        if (!selectedRing) {
          return embeds.deny(message, `You don't have **${storeItem.name}** in your inventory. Use \`inventory\` to see your rings.`);
        }
      } else {
        // No ring specified - use the most expensive one
        let bestRingPrice = 0;

        for (const ring of rings) {
          const storeItem = await storeService.getItemById(ring.id);
          if (storeItem && storeItem.price > bestRingPrice) {
            selectedRing = ring;
            bestRingPrice = storeItem.price;
          }
        }
      }

      if (!selectedRing) {
        return embeds.deny(message, 'You need a ring to propose! Buy one from the `store rings`.');
      }

      // Create proposal confirmation for target user
      const proposalText = `💍 **${message.author.username}** is proposing to **${targetUser.username}** with a **${selectedRing.name}**! do you accept this proposal?`;

      // Create confirmation for target user
      await createConfirmation(
        { ...message, author: targetUser, channel: message.channel },
        proposalText,
        async (interaction) => {
          try {
            // Re-check marriage status
            const authorCheck = await userService.get(message.author.id);
            const targetCheck = await userService.get(targetUser.id);

            if (authorCheck?.Marriage?.partnerId) {
              const errorEmbed = embeds.createDeny(message, `**${message.author.username}** is **already** married!`);
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            if (targetCheck?.Marriage?.partnerId) {
              const errorEmbed = embeds.createDeny(message, `**${targetUser.username}** is already married!`);
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Remove ring from inventory
            const removeSuccess = await userService.removeInventoryItem(message.author.id, selectedRing.id, 1);
            if (!removeSuccess) {
              const errorEmbed = embeds.createDeny(message, 'Failed to use the ring. Please try again.');
              return await interaction.editReply({ embeds: [errorEmbed], components: [] });
            }

            // Set marriage data for both users
            const marriedAt = new Date();
            await userService.setUserField(message.author.id, 'Marriage', {
              partnerId: targetUser.id,
              marriedAt: marriedAt,
              ringId: selectedRing.id
            });

            await userService.setUserField(targetUser.id, 'Marriage', {
              partnerId: message.author.id,
              marriedAt: marriedAt,
              ringId: selectedRing.id
            });

            // Success message
            const successEmbed = embeds.createSuccess(message, `💍 <@${message.author.id}> and <@${targetUser.id}> are now married! Congratulations! 🎉`);

            await interaction.editReply({ embeds: [successEmbed], components: [] });

          } catch (error) {
            logger.webhook.error(error, message);
            const errorEmbed = embeds.createDeny(message, 'An error occurred while processing the marriage.');
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          }
        },
        async (interaction) => {
          // Rejection callback
          const rejectEmbed = embeds.createWarn(message, `💔 <@${targetUser.id}> rejected the proposal from <@${message.author.id}>.`);
          
          await interaction.editReply({ embeds: [rejectEmbed], components: [] });
        }
      );

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while processing the marriage proposal.');
    }
  }
};
