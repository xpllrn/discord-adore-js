const { embeds } = require('../../core/embeds');
const { getUserPrefix, setUserPrefix, clearUserPrefix } = require('../../utils/commandProcessor');

module.exports = {
  name: "selfprefix",
  aliases: ['sp'],
  description: `Manage your personal prefix`,
  usage: `{guildprefix}selfprefix [set/remove] [prefix]`,
  permission: "Premium",

  run: async (_, message, args) => {

    const subcommand = args[0]?.toLowerCase();
    const newPrefix = args[1];

    if (!subcommand) {
      const userPrefix = await getUserPrefix(message.author.id);

      const description = userPrefix 
        ? `**Your self prefix:** \`${userPrefix}\``
        : `**Your self prefix:** *Not set*`;

      return embeds.info(message, description);
    }

    // Handle subcommands
    if (subcommand === 'set') {
      return handleSetSelfPrefix(message, newPrefix);
    } else if (subcommand === 'remove' || subcommand === 'clear') {
      return handleRemoveSelfPrefix(message);
    } else {
      const { processCommand } = require('../../utils/commandProcessor');
      return processCommand({
        ...message,
        content: `,h selfprefix`
      });
    }
  }
};

async function handleSetSelfPrefix(message, newPrefix) {
  if (!newPrefix) {
    return embeds.warn(message, "Please provide a prefix to set!");
  }

  if (newPrefix.length > 3) {
    return embeds.warn(message, "Prefix **can't** be over 3 characters.");
  }

  if (newPrefix.includes(' ')) {
    return embeds.warn(message, "Prefix **can't** contain spaces.");
  }

  const success = await setUserPrefix(message.author.id, newPrefix);
  if (success) {
    return embeds.success(message, `Your self prefix has been **set** to \`${newPrefix}\``);
  } else {
    return embeds.warn(message, "Failed to set self prefix. Please try again.");
  }
}

async function handleRemoveSelfPrefix(message) {
  const success = await clearUserPrefix(message.author.id);
  if (success) {
    return embeds.success(message, "Your self prefix has been **removed**!");
  } else {
    return embeds.warn(message, "Failed to remove self prefix. Please try again.");
  }
}
