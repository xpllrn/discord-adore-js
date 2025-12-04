const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../../utils/permissions');
const { getService } = require('@services');
const logger = require('../../../utils/logger');

module.exports = {
  name: "economy",
  aliases: ['eco'],
  description: 'Economy management utilities',
  permission: 'developer',
  syntax: 'economy [subcommand] [parameters]',
  example: 'economy addbal @user 1000',
  isGroupCommand: true,

  subcommands: {
    addbal: {
      name: 'addbal',
      aliases: ['addbalance'],
      description: 'Add balance to a user\'s wallet',
      syntax: '{guildprefix}economy addbal [@user] [amount]',
      parameters: ['user', 'amount'],
      example: '{guildprefix}economy addbal @user 1000',

      handler: async (client, message, args) => {
        if (!args[0]) {
          return embeds.warn(message, 'Please mention a **user** to add balance to!\n\nSyntax: `,eco addbal @user 1000`');
        }

        if (!args[1]) {
          return embeds.warn(message, 'Please specify an **amount** to add!\n\nSyntax: `,eco addbal @user 1000`');
        }

        // Parse user mention or ID
        let targetUser;
        const userMention = args[0];
        
        if (userMention.startsWith('<@') && userMention.endsWith('>')) {
          const userId = userMention.slice(2, -1).replace('!', '');
          targetUser = await client.users.fetch(userId).catch(() => null);
        } else if (/^\d{17,19}$/.test(userMention)) {
          targetUser = await client.users.fetch(userMention).catch(() => null);
        }

        if (!targetUser) {
          return embeds.warn(message, 'Please provide a **valid user mention or ID**!\n\nSyntax: `,eco addbal @user 1000`');
        }

        // Parse amount
        const amount = parseInt(args[1]);
        if (isNaN(amount)) {
          return embeds.warn(message, 'Please provide a **valid number** for the amount!\n\nSyntax: `,eco addbal @user 1000`');
        }

        if (amount <= 0) {
          return embeds.warn(message, 'Amount must be **greater than 0**!');
        }

        if (amount > 1000000000) {
          return embeds.warn(message, 'Amount cannot exceed **1,000,000,000**!');
        }

        try {
          const userService = getService('user');

          await userService.ensureUserData(targetUser.id);
          const success = await userService.updateWallet(targetUser.id, amount);
          
          if (!success) {
            return embeds.deny(message, 'Failed to update wallet. Please try again.');
          }

          const gambling = await userService.getGamblingData(targetUser.id);
          const newBalance = gambling.wallet;

          return embeds.success(message, 
            `Successfully added **${amount.toLocaleString()}** coins to ${targetUser.username}'s wallet!\n\n` +
            `**New Balance:** ${newBalance.toLocaleString()} coins`
          );

        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `An error occurred while adding balance to ${targetUser.username}'s wallet.`);
        }
      }
    },

    cleanbal: {
      name: 'cleanbal',
      aliases: ['removebal'],
      description: 'Remove balance from a user\'s wallet',
      syntax: '{guildprefix}economy cleanbal [@user] [amount]',
      parameters: ['user', 'amount'],
      example: '{guildprefix}economy cleanbal @user 100',

      handler: async (client, message, args) => {
        if (!args[0]) {
          return embeds.warn(message, 'Please mention a **user** to remove balance from!\n\nSyntax: `,eco cleanbal @user 100`');
        }

        if (!args[1]) {
          return embeds.warn(message, 'Please specify an **amount** to remove!\n\nSyntax: `,eco cleanbal @user 100`');
        }

        // Parse user mention or ID
        let targetUser;
        const userMention = args[0];
        
        if (userMention.startsWith('<@') && userMention.endsWith('>')) {
          const userId = userMention.slice(2, -1).replace('!', '');
          targetUser = await client.users.fetch(userId).catch(() => null);
        } else if (/^\d{17,19}$/.test(userMention)) {
          targetUser = await client.users.fetch(userMention).catch(() => null);
        }

        if (!targetUser) {
          return embeds.warn(message, 'Please provide a **valid user mention or ID**!\n\nSyntax: `,eco cleanbal @user 100`');
        }

        // Parse amount
        const amount = parseInt(args[1]);
        if (isNaN(amount)) {
          return embeds.warn(message, 'Please provide a **valid number** for the amount!\n\nSyntax: `,eco cleanbal @user 100`');
        }

        if (amount <= 0) {
          return embeds.warn(message, 'Amount must be **greater than 0**!');
        }

        if (amount > 1000000000) {
          return embeds.warn(message, 'Amount cannot exceed **1,000,000,000**!');
        }

        try {
          const userService = getService('user');

          await userService.ensureUserData(targetUser.id);
          const gambling = await userService.getGamblingData(targetUser.id);
          const currentBalance = gambling.wallet;

          const success = await userService.updateWallet(targetUser.id, -amount);
          
          if (!success) {
            return embeds.deny(message, 'Failed to update wallet. Please try again.');
          }

          const updatedGambling = await userService.getGamblingData(targetUser.id);
          const newBalance = updatedGambling.wallet;

          return embeds.success(message, 
            `Successfully removed **${amount.toLocaleString()}** coins from ${targetUser.username}'s wallet!\n\n` +
            `**New Balance:** ${newBalance.toLocaleString()} coins`
          );

        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `An error occurred while removing balance from ${targetUser.username}'s wallet.`);
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasPermissionLevel(message, 'dev')) return;

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'economy');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'economy');
  }
};
