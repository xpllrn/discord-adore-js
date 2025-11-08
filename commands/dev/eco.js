const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { hasPermissionLevel } = require('../../utils/permissions');

module.exports = {
  name: "eco",
  aliases: ['economy'],
  description: 'Economy management utilities',
  permission: 'dev',
  isGroupCommand: true,
  run: async(client, message, args) => {
    // Check dev permission (silent fail if not dev)
    if (!await hasPermissionLevel(message, 'dev')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'eco');
    }

    const subcommand = args[0].toLowerCase();

    if (subcommand === 'addbal' || subcommand === 'addbalance') {
      const subcommandInfo = {
        description: 'Add balance to a user\'s wallet',
        usage: '{guildprefix}eco addbal [@user] [amount]',
        aliases: ['addbalance'],
        parameters: ['user', 'amount'],
        example: '{guildprefix}eco addbal @user 1000'
      };
      await handleAddBalance(client, message, args);
    } else if (subcommand === 'cleanbal' || subcommand === 'removebal') {
      const subcommandInfo = {
        description: 'Remove balance from a user\'s wallet',
        usage: '{guildprefix}eco cleanbal [@user] [amount]',
        aliases: ['removebal'],
        parameters: ['user', 'amount'],
        example: '{guildprefix}eco cleanbal @user 100'
      };
      await handleCleanBalance(client, message, args);
    } else {
      return runHelpCommand(message, 'eco');
    }
  }
};

async function handleAddBalance(client, message, args) {
  if (!args[1]) {
    return embeds.warn(message, 'Please mention a **user** to add balance to!\n\nUsage: `,eco addbal @user 1000`');
  }

  if (!args[2]) {
    return embeds.warn(message, 'Please specify an **amount** to add!\n\nUsage: `,eco addbal @user 1000`');
  }

  // Parse user mention or ID
  let targetUser;
  const userMention = args[1];
  
  if (userMention.startsWith('<@') && userMention.endsWith('>')) {
    const userId = userMention.slice(2, -1).replace('!', '');
    targetUser = await client.users.fetch(userId).catch(() => null);
  } else if (/^\d{17,19}$/.test(userMention)) {
    targetUser = await client.users.fetch(userMention).catch(() => null);
  }

  if (!targetUser) {
    return embeds.warn(message, 'Please provide a **valid user mention or ID**!\n\nUsage: `,eco addbal @user 1000`');
  }

  // Parse amount
  const amount = parseInt(args[2]);
  if (isNaN(amount)) {
    return embeds.warn(message, 'Please provide a **valid number** for the amount!\n\nUsage: `,eco addbal @user 1000`');
  }

  if (amount <= 0) {
    return embeds.warn(message, 'Amount must be **greater than 0**!');
  }

  if (amount > 1000000000) { // 1 billion limit
    return embeds.warn(message, 'Amount cannot exceed **1,000,000,000**!');
  }

  try {
    // Use the service layer to ensure cache consistency
    const { getService } = require('@services');
    const userService = getService('user');

    // Ensure user data exists
    await userService.ensureUserData(targetUser.id);

    // Add balance using the service (this properly handles cache)
    const success = await userService.updateWallet(targetUser.id, amount);
    
    if (!success) {
      return embeds.deny(message, 'Failed to update wallet. Please try again.');
    }

    // Get updated balance
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

async function handleCleanBalance(client, message, args) {
  if (!args[1]) {
    return embeds.warn(message, 'Please mention a **user** to remove balance from!\n\nUsage: `,eco cleanbal @user 100`');
  }

  if (!args[2]) {
    return embeds.warn(message, 'Please specify an **amount** to remove!\n\nUsage: `,eco cleanbal @user 100`');
  }

  // Parse user mention or ID
  let targetUser;
  const userMention = args[1];
  
  if (userMention.startsWith('<@') && userMention.endsWith('>')) {
    const userId = userMention.slice(2, -1).replace('!', '');
    targetUser = await client.users.fetch(userId).catch(() => null);
  } else if (/^\d{17,19}$/.test(userMention)) {
    targetUser = await client.users.fetch(userMention).catch(() => null);
  }

  if (!targetUser) {
    return embeds.warn(message, 'Please provide a **valid user mention or ID**!\n\nUsage: `,eco cleanbal @user 100`');
  }

  // Parse amount
  const amount = parseInt(args[2]);
  if (isNaN(amount)) {
    return embeds.warn(message, 'Please provide a **valid number** for the amount!\n\nUsage: `,eco cleanbal @user 100`');
  }

  if (amount <= 0) {
    return embeds.warn(message, 'Amount must be **greater than 0**!');
  }

  if (amount > 1000000000) { // 1 billion limit
    return embeds.warn(message, 'Amount cannot exceed **1,000,000,000**!');
  }

  try {
    // Use the service layer to ensure cache consistency
    const { getService } = require('@services');
    const userService = getService('user');

    // Ensure user data exists
    await userService.ensureUserData(targetUser.id);

    // Get current balance
    const gambling = await userService.getGamblingData(targetUser.id);
    const currentBalance = gambling.wallet;

    // Remove balance using the service (negative amount)
    const success = await userService.updateWallet(targetUser.id, -amount);
    
    if (!success) {
      return embeds.deny(message, 'Failed to update wallet. Please try again.');
    }

    // Get updated balance
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
