const { embeds } = require('../../core/embeds');
const { getGuildPrefix, setGuildPrefix } = require('../../utils/commandProcessor');
const { hasDiscordPermission, PermissionFlagsBits } = require('../../utils/permissions');

module.exports = {
  name: "prefix",
  aliases: ['setprefix'],
  description: `Manage server prefix`,
  usage: `{guildprefix}prefix
{guildprefix}prefix set [prefix]`,

  run: async (_, message, args) => {
    const subcommand = args[0]?.toLowerCase();
    const newPrefix = args[1];

    if (!subcommand) {
      const guildPrefix = await getGuildPrefix(message.guild.id);

      const description = `Your Server **prefix:** \`${guildPrefix}\``;

      return embeds.info(message, description);
    }

    // Handle subcommands
    if (subcommand === 'set') {
      return handleSetGuildPrefix(message, newPrefix);
    } else {
      const { processCommand } = require('../../utils/commandProcessor');
      return processCommand({
        ...message,
        content: `,h prefix`
      });
    }
  }
};

async function handleSetGuildPrefix(message, newPrefix) {
  // Check if user has Administrator permission
  if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;

  if (!newPrefix) {
    return embeds.warn(message, "Please provide a prefix to set!");
  }

  if (newPrefix.toLowerCase() === 'none') {
    return embeds.warn(message, "Server prefix cannot be removed!");
  }

  if (newPrefix.length > 3) {
    return embeds.warn(message, "Prefix **can't** be over 3 characters.");
  }

  if (newPrefix.includes(' ')) {
    return embeds.warn(message, "Prefix **can't** contain spaces.");
  }

  const success = await setGuildPrefix(message.guild.id, newPrefix);
  if (success) {
    return embeds.success(message, `Server prefix has been **changed** to \`${newPrefix}\``);
  } else {
    return embeds.warn(message, "Failed to update server prefix. Please try again.");
  }
}
