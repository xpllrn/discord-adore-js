const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { colors } = require('../../config/setup');
const { hasDiscordPermission } = require('../../utils/permissions');

module.exports = {
  name: "alias",
  aliases: [],
  description: 'Create your own shortcuts for commands',
  permission: 'Manage Guild',
  isGroupCommand: true,
  run: async (client, message, args) => {
    if (!args[0]) {
      const { runHelpCommand } = require('../../utils/commandProcessor');
      return runHelpCommand(message, 'alias');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'add':
      case 'create': {
        const subcommandInfo = {
          description: 'Create an alias for a command with optional {0} placeholder',
          usage: '{guildprefix}alias add [shortcut] [command]',
          aliases: ['create'],
          example: '{guildprefix}alias add deport ban'
        };
        return await handleAddAlias(message, args);
      }
      
      case 'remove':
      case 'delete': {
        const subcommandInfo = {
          description: 'Remove an alias',
          usage: '{guildprefix}alias remove [shortcut]',
          aliases: ['delete'],
          example: '{guildprefix}alias remove bal'
        };
        return await handleRemoveAlias(message, args);
      }
      
      case 'removeall':
      case 'clear': {
        const subcommandInfo = {
          description: 'Remove all aliases in this server',
          usage: '{guildprefix}alias removeall',
          aliases: ['clear'],
          example: '{guildprefix}alias removeall'
        };
        return await handleRemoveAllAliases(message);
      }
      
      case 'list':
      case 'view': {
        const subcommandInfo = {
          description: 'List all your aliases',
          usage: '{guildprefix}alias list',
          aliases: ['view'],
          example: '{guildprefix}alias list'
        };
        return await handleListAliases(message);
      }
      
      case 'reset': {
        const subcommandInfo = {
          description: 'Reset all your aliases',
          usage: '{guildprefix}alias reset',
          aliases: [],
          example: '{guildprefix}alias reset'
        };
        return await handleResetAliases(message);
      }
      
      default: {
        const { runHelpCommand } = require('../../utils/commandProcessor');
        return runHelpCommand(message, 'alias');
      }
    }
  }
};

// Add alias handler
async function handleAddAlias(message, args) {
  if (args.length < 3) {
    return embeds.warn(message, 'Please provide a shortcut and command: `alias add [shortcut] [command]`\nExample: `alias add bal balance`\nWith placeholder: `alias add pic role {0} @PicPerms`');
  }

  const shortcut = args[1].toLowerCase();
  const command = args.slice(2).join(' ');

  // Validate shortcut
  if (shortcut.length > 20) {
    return embeds.warn(message, 'Shortcut cannot be longer than 20 characters');
  }

  if (shortcut.includes(' ')) {
    return embeds.warn(message, 'Shortcut cannot contain spaces');
  }

  // Check if shortcut conflicts with existing commands
  const existingCommand = message.client.commands.get(shortcut) || 
                          message.client.commands.get(message.client.aliases.get(shortcut));
  
  if (existingCommand) {
    return embeds.warn(message, `Cannot create alias \`${shortcut}\` - it conflicts with an existing command`);
  }

  // Validate command exists (check first word before {0} placeholder)
  const commandBase = command.split(' ')[0].toLowerCase();
  const targetCommand = message.client.commands.get(commandBase) ||
                       message.client.commands.get(message.client.aliases.get(commandBase));
  
  if (!targetCommand) {
    return embeds.warn(message, `Command \`${commandBase}\` does not exist`);
  }

  try {
    const guildService = getService('guild');
    
    // Get guild's current aliases
    const guildData = await guildService.ensureGuildData(message.guild.id);
    const aliases = guildData.Aliases || [];

    // Check if guild has reached max aliases (limit to 50)
    if (aliases.length >= 50) {
      return embeds.warn(message, 'This server has reached the maximum of 50 aliases. Remove some before adding more.');
    }

    // Check if shortcut already exists
    const existingAlias = aliases.find(a => a.shortcut === shortcut);
    
    if (existingAlias) {
      // Update existing alias
      existingAlias.command = command;
      existingAlias.createdBy = message.author.id;
      existingAlias.createdAt = new Date();
      
      await guildService.set(message.guild.id, guildData);
      return embeds.success(message, `Updated alias \`${shortcut}\` to execute \`${command}\``);
    } else {
      // Add new alias
      aliases.push({
        shortcut,
        command,
        createdBy: message.author.id,
        createdAt: new Date()
      });
      
      guildData.Aliases = aliases;
      await guildService.set(message.guild.id, guildData);
      return embeds.success(message, `Created alias \`${shortcut}\` for command \`${command}\``);
    }
  } catch (error) {
    console.error('Error adding alias:', error);
    return embeds.deny(message, 'Failed to create alias. Please try again.');
  }
}

// Remove alias handler
async function handleRemoveAlias(message, args) {
  if (args.length < 2) {
    return embeds.warn(message, 'Please provide a shortcut to remove: `alias remove [shortcut]`');
  }

  const shortcut = args[1].toLowerCase();

  try {
    const guildService = getService('guild');
    const guildData = await guildService.ensureGuildData(message.guild.id);
    const aliases = guildData.Aliases || [];

    const aliasIndex = aliases.findIndex(a => a.shortcut === shortcut);
    
    if (aliasIndex === -1) {
      return embeds.warn(message, `This server doesn't have an alias named \`${shortcut}\``);
    }

    const removedCommand = aliases[aliasIndex].command;
    aliases.splice(aliasIndex, 1);
    
    guildData.Aliases = aliases;
    await guildService.set(message.guild.id, guildData);
    
    return embeds.success(message, `Removed alias \`${shortcut}\` (was: \`${removedCommand}\`)`);
  } catch (error) {
    console.error('Error removing alias:', error);
    return embeds.deny(message, 'Failed to remove alias. Please try again.');
  }
}

// Remove all aliases handler
async function handleRemoveAllAliases(message) {
  try {
    const guildService = getService('guild');
    const guildData = await guildService.ensureGuildData(message.guild.id);
    const aliases = guildData.Aliases || [];

    if (aliases.length === 0) {
      return embeds.warn(message, 'This server doesn\'t have any aliases to remove');
    }

    const count = aliases.length;
    guildData.Aliases = [];
    await guildService.set(message.guild.id, guildData);
    
    return embeds.success(message, `Removed all ${count} alias${count === 1 ? '' : 'es'}`);
  } catch (error) {
    console.error('Error removing all aliases:', error);
    return embeds.deny(message, 'Failed to remove aliases. Please try again.');
  }
}

// Reset aliases handler (same as removeall)
async function handleResetAliases(message) {
  return await handleRemoveAllAliases(message);
}

// List aliases handler
async function handleListAliases(message) {
  try {
    const guildService = getService('guild');
    const guildData = await guildService.ensureGuildData(message.guild.id);
    const aliases = guildData.Aliases || [];

    if (aliases.length === 0) {
      return embeds.warn(message, 'This server doesn\'t have any aliases set up\nCreate one with: `alias add [shortcut] [command]`');
    }

    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle(`${message.guild.name}'s Aliases`)
      .setDescription(`This server has **${aliases.length}** alias${aliases.length === 1 ? '' : 'es'}`)
      .setFooter({ text: `Use "alias remove [shortcut]" to remove an alias` });

    // Sort aliases alphabetically
    const sortedAliases = aliases.sort((a, b) => a.shortcut.localeCompare(b.shortcut));

    // Group aliases into fields (max 25 fields, 1024 chars per field)
    let currentField = '';
    let fieldCount = 0;

    for (const alias of sortedAliases) {
      const creator = alias.createdBy ? `<@${alias.createdBy}>` : 'Unknown';
      const line = `\`${alias.shortcut}\` → \`${alias.command}\` (by ${creator})\n`;
      
      if (currentField.length + line.length > 1024 || fieldCount >= 25) {
        if (currentField) {
          embed.addFields({ name: '\u200b', value: currentField, inline: false });
          currentField = '';
          fieldCount++;
        }
      }
      
      currentField += line;
    }

    if (currentField) {
      embed.addFields({ name: '\u200b', value: currentField, inline: false });
    }

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing aliases:', error);
    return embeds.deny(message, 'Failed to list aliases. Please try again.');
  }
}
