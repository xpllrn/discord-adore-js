const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
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
      try {
        const prefixService = getService('prefix');
        const guildPrefix = await prefixService.getGuildPrefix(message.guild.id);
        const description = `Your Server **prefix:** \`${guildPrefix}\``;
        return embeds.info(message, description);
      } catch (error) {
        console.error('Error getting guild prefix:', error.message);
        return embeds.warn(message, 'Failed to retrieve server prefix. Please try again.');
      }
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
  console.log(`🔧 [PREFIX] Starting prefix change for guild ${message.guild.id} (${message.guild.name})`);
  console.log(`🔧 [PREFIX] User: ${message.author.tag} (${message.author.id})`);
  console.log(`🔧 [PREFIX] Requested prefix: "${newPrefix}"`);

  // Check if user has Administrator permission
  if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) {
    console.log(`❌ [PREFIX] Permission denied for ${message.author.tag}`);
    return;
  }

  if (!newPrefix) {
    console.log(`❌ [PREFIX] No prefix provided`);
    return embeds.warn(message, "Please provide a prefix to set!");
  }

  if (newPrefix.toLowerCase() === 'none') {
    console.log(`❌ [PREFIX] Attempted to remove prefix (not allowed)`);
    return embeds.warn(message, "Server prefix cannot be removed!");
  }

  if (newPrefix.length > 3) {
    console.log(`❌ [PREFIX] Prefix too long: ${newPrefix.length} characters`);
    return embeds.warn(message, "Prefix **can't** be over 3 characters.");
  }

  if (newPrefix.includes(' ')) {
    console.log(`❌ [PREFIX] Prefix contains spaces`);
    return embeds.warn(message, "Prefix **can't** contain spaces.");
  }

  console.log(`✅ [PREFIX] Validation passed, attempting to save prefix "${newPrefix}"`);
  
  try {
    const prefixService = getService('prefix');
    const success = await prefixService.setGuildPrefix(message.guild.id, newPrefix);
    
    console.log(`📊 [PREFIX] Save result: ${success ? 'SUCCESS' : 'FAILED'}`);
    
    if (success) {
      // Verify the prefix was actually saved by reading it back
      console.log(`🔍 [PREFIX] Verifying saved prefix...`);
      const savedPrefix = await prefixService.getGuildPrefix(message.guild.id);
      console.log(`📊 [PREFIX] Verification: saved prefix is "${savedPrefix}"`);
      console.log(`📊 [PREFIX] Match check: ${savedPrefix === newPrefix ? 'MATCHES' : 'MISMATCH!'}`);
      
      console.log(`✅ [PREFIX] Successfully changed prefix for ${message.guild.name} to "${newPrefix}"`);
      return embeds.success(message, `Server prefix has been **changed** to \`${newPrefix}\``);
    } else {
      console.log(`❌ [PREFIX] Failed to save prefix for ${message.guild.name}`);
      return embeds.warn(message, "Failed to update server prefix. Please try again.");
    }
  } catch (error) {
    console.error(`❌ [PREFIX] Error saving prefix:`, error.message);
    return embeds.warn(message, "An error occurred while updating the prefix. Please try again.");
  }
}
