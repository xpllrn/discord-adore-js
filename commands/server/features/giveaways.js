const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findChannel, findUser, findRole } = require('../../../handlers/finder');
const { getService } = require('@services');
const config = require('../../../config/setup');
const ms = require('ms');
const logger = require('../../../utils/logger');

// Helper function to parse message links
function parseMessageLink(link) {
  const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const match = link.match(messageLinkRegex);
  if (match) {
    return { guildId: match[1], channelId: match[2], messageId: match[3] };
  }
  return null;
}

// Helper function to resolve giveaway from reply, message ID, or message link
async function resolveGiveaway(message, args, guildService) {
  // Check if user replied to a message
  if (message.reference?.messageId) {
    const giveaway = await guildService.getGiveawayByMessageId(message.guild.id, message.reference.messageId);
    if (giveaway) {
      return {
        giveaway,
        linkData: { 
          guildId: message.guild.id, 
          channelId: message.reference.channelId || message.channel.id, 
          messageId: message.reference.messageId 
        },
        remainingArgs: args
      };
    }
  }

  // Check if first arg is a message ID (17-19 digit number)
  if (args[0] && /^\d{17,19}$/.test(args[0])) {
    const giveaway = await guildService.getGiveawayByMessageId(message.guild.id, args[0]);
    if (giveaway) {
      return {
        giveaway,
        linkData: { 
          guildId: message.guild.id, 
          channelId: giveaway.channelId, 
          messageId: args[0] 
        },
        remainingArgs: args.slice(1)
      };
    }
  }

  // Check if first arg is a message link
  if (args[0]) {
    const linkData = parseMessageLink(args[0]);
    if (linkData) {
      if (linkData.guildId !== message.guild.id) {
        return { error: 'I can only manage giveaways from this server' };
      }
      const giveaway = await guildService.getGiveawayByMessageId(message.guild.id, linkData.messageId);
      if (giveaway) {
        return { giveaway, linkData, remainingArgs: args.slice(1) };
      }
    }
  }

  return { error: 'No giveaway found. Reply to a giveaway message, provide a message ID, or message link' };
}

// Helper function to create giveaway embed
function createGiveawayEmbed(giveaway, guild) {
  const embed = new EmbedBuilder()
    .setColor(giveaway.color || config.colors.embed)
    .setTitle(giveaway.title)
    .setDescription(giveaway.description)
    .addFields(
      { name: 'Ends', value: `<t:${Math.floor(new Date(giveaway.endTime).getTime() / 1000)}:R>`, inline: true },
      { name: 'Winners', value: giveaway.winners.toString(), inline: true },
      { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true }
    )
    .setFooter({ text: `${giveaway.participants.length} participants` })
    .setTimestamp();

  if (guild) {
    embed.setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) });
  }
  if (giveaway.image) {
    embed.setImage(giveaway.image);
  }
  if (giveaway.thumbnail) {
    embed.setThumbnail(giveaway.thumbnail);
  }

  const requirements = [];
  if (giveaway.requirements.minLevel) requirements.push(`> Min level: **${giveaway.requirements.minLevel}**`);
  if (giveaway.requirements.maxLevel) requirements.push(`> Max level: **${giveaway.requirements.maxLevel}**`);
  if (giveaway.requirements.level) requirements.push(`> Must have **level ${giveaway.requirements.level}**`);
  if (giveaway.requirements.roleId) requirements.push(`> Must have <@&${giveaway.requirements.roleId}>`);
  if (giveaway.requirements.requiredRoles?.length > 0) {
    requirements.push(`> Required roles: ${giveaway.requirements.requiredRoles.map(r => `<@&${r}>`).join(', ')}`);
  }
  if (giveaway.requirements.accountAge) requirements.push(`> Account age: **${giveaway.requirements.accountAge}+ days**`);
  if (giveaway.requirements.serverStay) requirements.push(`> Server member for: **${giveaway.requirements.serverStay}+ days**`);
  if (requirements.length > 0) {
    embed.addFields({ name: '**Requirements**', value: requirements.join('\n'), inline: false });
  }

  if (giveaway.winnerRoles?.length > 0) {
    embed.addFields({ name: '**Winner Rewards**', value: `Roles: ${giveaway.winnerRoles.map(r => `<@&${r}>`).join(', ')}`, inline: false });
  }

  return embed;
}

function selectRandomWinners(participants, count) {
  if (participants.length <= count) return [...participants];
  const shuffled = [...participants].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function updateGiveawayMessage(giveaway, linkData, guild) {
  try {
    const channel = guild.channels.cache.get(linkData.channelId);
    if (!channel) return false;
    const giveawayMessage = await channel.messages.fetch(linkData.messageId);
    if (!giveawayMessage) return false;
    const updatedEmbed = createGiveawayEmbed(giveaway, guild);
    await giveawayMessage.edit({ embeds: [updatedEmbed] });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  name: "giveaways",
  aliases: ['giveaway', 'gw'],
  description: `Manage server giveaways`,
  syntax: 'giveaways [subcommand] (parameters)',
  example: 'giveaways start 1d 1 Nitro',
  permission: "manage_channels",
  isGroupCommand: true,

  subcommands: {
    start: {
      name: 'start',
      aliases: ['create'],
      description: 'Start a new giveaway',
      syntax: '{guildprefix}giveaways start [duration] [winners] [title]',
      parameters: ['duration', 'winners', 'title'],
      example: '{guildprefix}giveaways start 1d 1 Nitro',

      handler: async (client, message, args, guildService) => {
        if (args.length < 1) return runHelpCommand(message, 'giveaways');

        let channel = message.channel;
        let argIndex = 0;

        const channelResult = await findChannel(message.guild, args[0], client);
        if (channelResult.found) {
          channel = channelResult.channel;
          argIndex = 1;
        }

        const durationArg = args[argIndex];
        const parsedDuration = ms(durationArg);
        let duration = parsedDuration && parsedDuration > 0 ? parsedDuration : ms('24h');
        if (parsedDuration) argIndex++;

        const winnersArg = args[argIndex];
        const parsedWinners = parseInt(winnersArg);
        let winners = 1;
        if (parsedWinners && parsedWinners > 0 && parsedWinners <= 20) {
          winners = parsedWinners;
          argIndex++;
        } else if (!isNaN(parsedWinners)) {
          return embeds.warn(message, 'Number of winners must be between **1** and **20**');
        }

        const title = args.slice(argIndex).join(' ');
        if (!title) return embeds.warn(message, 'Please provide a **title** for the giveaway');
        if (title.length > 256) return embeds.warn(message, 'Giveaway title must be **256 characters or less**');

        if (duration < ms('1m')) return embeds.warn(message, 'Giveaway duration must be at least **1 minute**');
        if (duration > ms('30d')) return embeds.warn(message, 'Giveaway duration cannot exceed **30 days**');

        try {
          const endTime = new Date(Date.now() + duration);
          const giveawayData = {
            title, description: 'React with 🎉 to enter the giveaway.',
            channelId: channel.id, messageId: null, hostId: message.author.id,
            winners, endTime, 
            requirements: { 
              level: null, roleId: null, minLevel: null, maxLevel: null,
              requiredRoles: [], accountAge: null, serverStay: null 
            },
            participants: [], winnerIds: [], image: null, thumbnail: null, 
            color: null, winnerRoles: [], isActive: true
          };

          const embed = createGiveawayEmbed(giveawayData, message.guild);
          const giveawayMessage = await channel.send({ embeds: [embed] });
          await giveawayMessage.react('🎉');

          giveawayData.messageId = giveawayMessage.id;
          await guildService.addGiveaway(message.guild.id, giveawayData);

          return embeds.success(message, `Giveaway **${title}** started in ${channel}!`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to start giveaway. Please check my permissions.');
        }
      }
    },

    end: {
      name: 'end',
      aliases: [],
      description: 'End a giveaway early',
      syntax: '{guildprefix}giveaways end (message_id/link or reply)',
      parameters: ['message_id/link (optional if replying)'],
      example: '{guildprefix}giveaways end 1234567890123456789',

      handler: async (client, message, args, guildService) => {
        const resolved = await resolveGiveaway(message, args, guildService);
        if (resolved.error) return embeds.warn(message, resolved.error);
        
        const { giveaway, linkData } = resolved;
        if (!giveaway.isActive) return embeds.warn(message, 'This giveaway has already ended');

        try {
          const channel = message.guild.channels.cache.get(linkData.channelId);
          if (!channel) return embeds.warn(message, 'Giveaway channel not found');

          const giveawayMessage = await channel.messages.fetch(linkData.messageId);
          if (!giveawayMessage) return embeds.warn(message, 'Giveaway message not found');

          const winners = selectRandomWinners(giveaway.participants, giveaway.winners);
          await guildService.endGiveaway(message.guild.id, giveaway.id, winners);

          const endedEmbed = createGiveawayEmbed({ ...giveaway, isActive: false, winnerIds: winners }, message.guild)
            .setColor(config.colors.success)
            .setTitle(`🎉 ${giveaway.title} (ENDED)`);

          endedEmbed.addFields({
            name: 'Winners',
            value: winners.length > 0 ? winners.map(id => `<@${id}>`).join('\n') : 'No valid participants',
            inline: false
          });

          await giveawayMessage.edit({ embeds: [endedEmbed] });

          if (winners.length > 0) {
            await channel.send(`🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.title}**!`);
          } else {
            await channel.send(`😔 No valid participants for **${giveaway.title}**. No winners selected.`);
          }

          return embeds.success(message, `Giveaway **${giveaway.title}** has been ended!`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to end giveaway. Please check my permissions.');
        }
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all active giveaways',
      syntax: '{guildprefix}giveaways list',
      parameters: [],
      example: '{guildprefix}giveaways list',

      handler: async (client, message, args, guildService) => {
        const activeGiveaways = await guildService.getActiveGiveaways(message.guild.id);

        if (activeGiveaways.length === 0) {
          return embeds.info(message, 'There are no active giveaways in this server');
        }

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Active Giveaways')
          .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        const giveawayList = activeGiveaways.map(giveaway => {
          const channel = message.guild.channels.cache.get(giveaway.channelId);
          const channelMention = channel ? channel.toString() : 'Unknown Channel';
          const endTime = Math.floor(new Date(giveaway.endTime).getTime() / 1000);
          return `**${giveaway.title}**\nChannel: ${channelMention}\nWinners: ${giveaway.winners} | Participants: ${giveaway.participants.length}\nEnds: <t:${endTime}:R>\n[Jump to Message](https://discord.com/channels/${message.guild.id}/${giveaway.channelId}/${giveaway.messageId})`;
        }).join('\n\n');

        embed.setDescription(giveawayList);
        embed.setFooter({ text: `${activeGiveaways.length} active giveaway${activeGiveaways.length !== 1 ? 's' : ''}` });

        return message.channel.send({ embeds: [embed] });
      }
    },

    cancel: {
      name: 'cancel',
      aliases: [],
      description: 'Cancel a giveaway',
      syntax: '{guildprefix}giveaways cancel (message_id/link or reply)',
      parameters: ['message_id/link (optional if replying)'],
      example: '{guildprefix}giveaways cancel 1234567890123456789',

      handler: async (client, message, args, guildService) => {
        const resolved = await resolveGiveaway(message, args, guildService);
        if (resolved.error) return embeds.warn(message, resolved.error);
        
        const { giveaway, linkData } = resolved;
        if (!giveaway.isActive) return embeds.warn(message, 'This giveaway has already ended');

        try {
          const channel = message.guild.channels.cache.get(linkData.channelId);
          if (!channel) return embeds.warn(message, 'Giveaway channel not found');

          const giveawayMessage = await channel.messages.fetch(linkData.messageId);
          if (!giveawayMessage) return embeds.warn(message, 'Giveaway message not found');

          await guildService.deleteGiveaway(message.guild.id, giveaway.id);

          const cancelledEmbed = createGiveawayEmbed(giveaway, message.guild)
            .setColor(config.colors.error)
            .setTitle(`❌ ${giveaway.title} (CANCELLED)`)
            .setDescription('This giveaway has been cancelled by a moderator.');

          await giveawayMessage.edit({ embeds: [cancelledEmbed] });

          return embeds.success(message, `Giveaway **${giveaway.title}** has been cancelled!`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to cancel giveaway. Please check my permissions.');
        }
      }
    },

    reroll: {
      name: 'reroll',
      aliases: [],
      description: 'Reroll giveaway winners',
      syntax: '{guildprefix}giveaways reroll (message_id/link or reply) [winners]',
      parameters: ['message_id/link (optional if replying)', 'winners (optional)'],
      example: '{guildprefix}giveaways reroll 1234567890123456789 2',

      handler: async (client, message, args, guildService) => {
        const resolved = await resolveGiveaway(message, args, guildService);
        if (resolved.error) return embeds.warn(message, resolved.error);
        
        const { giveaway, linkData, remainingArgs } = resolved;
        if (giveaway.isActive) return embeds.warn(message, 'Cannot reroll an active giveaway. End it first.');

        let winnersToReroll = giveaway.winners;
        if (remainingArgs[0]) {
          const parsed = parseInt(remainingArgs[0]);
          if (parsed && parsed > 0 && parsed <= 20) winnersToReroll = parsed;
          else if (!isNaN(parsed)) return embeds.warn(message, 'Number of winners must be between **1** and **20**');
        }

        try {
          const channel = message.guild.channels.cache.get(linkData.channelId);
          if (!channel) return embeds.warn(message, 'Giveaway channel not found');

          const giveawayMessage = await channel.messages.fetch(linkData.messageId);
          if (!giveawayMessage) return embeds.warn(message, 'Giveaway message not found');

          const newWinners = selectRandomWinners(giveaway.participants, winnersToReroll);
          await guildService.updateGiveaway(message.guild.id, giveaway.id, { winnerIds: newWinners });

          const rerolledEmbed = createGiveawayEmbed({ ...giveaway, winnerIds: newWinners }, message.guild)
            .setColor(config.colors.success)
            .setTitle(`🎉 ${giveaway.title} (REROLLED)`);

          rerolledEmbed.addFields({
            name: 'New Winners',
            value: newWinners.length > 0 ? newWinners.map(id => `<@${id}>`).join('\n') : 'No valid participants',
            inline: false
          });

          await giveawayMessage.edit({ embeds: [rerolledEmbed] });

          if (newWinners.length > 0) {
            await channel.send(`🎉 New winners for **${giveaway.title}**: ${newWinners.map(id => `<@${id}>`).join(', ')}!`);
          } else {
            await channel.send(`😔 No valid participants for reroll of **${giveaway.title}**.`);
          }

          return embeds.success(message, `Giveaway **${giveaway.title}** has been rerolled!`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to reroll giveaway. Please check my permissions.');
        }
      }
    },

    edit: {
      name: 'edit',
      aliases: [],
      description: 'Edit giveaway settings',
      syntax: '{guildprefix}giveaways edit [type] (message_id/link or reply) [value]',
      parameters: ['type', 'message_id/link (optional if replying)', 'value'],
      example: '{guildprefix}giveaways edit prize 1234567890123456789 Nitro Classic',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return runHelpCommand(message, 'giveaways');

        const editType = args[0].toLowerCase();
        const validEditTypes = [
          'prize', 'winners', 'duration', 'color', 'minlevel', 'maxlevel',
          'requiredroles', 'roles', 'thumbnail', 'age', 'stay',
          'level', 'role', 'host', 'description', 'image'
        ];
        if (!validEditTypes.includes(editType)) {
          return embeds.warn(message, `Invalid edit type. Valid options: ${validEditTypes.join(', ')}`);
        }

        const resolved = await resolveGiveaway(message, args.slice(1), guildService);
        if (resolved.error) return embeds.warn(message, resolved.error);
        
        const { giveaway, linkData, remainingArgs } = resolved;
        if (!giveaway.isActive) return embeds.warn(message, 'Cannot edit an ended giveaway');

        const editArgs = remainingArgs;

        try {
          let updateData = {};
          let successMsg = '';

          switch (editType) {
            case 'prize': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **prize/title** for the giveaway');
              const newTitle = editArgs.join(' ');
              if (newTitle.length > 256) return embeds.warn(message, 'Prize must be **256 characters or less**');
              updateData = { title: newTitle };
              successMsg = `Prize changed to: **${newTitle}**`;
              break;
            }
            case 'winners': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide the **number of winners**');
              const winnerCount = parseInt(editArgs[0]);
              if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
                return embeds.warn(message, 'Number of winners must be between **1** and **20**');
              }
              updateData = { winners: winnerCount };
              successMsg = `Winner count changed to: **${winnerCount}**`;
              break;
            }
            case 'duration': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **duration** (e.g., 1d, 12h, 30m)');
              const newDuration = ms(editArgs[0]);
              if (!newDuration || newDuration < ms('1m')) {
                return embeds.warn(message, 'Duration must be at least **1 minute**');
              }
              if (newDuration > ms('30d')) {
                return embeds.warn(message, 'Duration cannot exceed **30 days**');
              }
              const newEndTime = new Date(Date.now() + newDuration);
              updateData = { endTime: newEndTime };
              successMsg = `End time changed to: <t:${Math.floor(newEndTime.getTime() / 1000)}:R>`;
              break;
            }
            case 'color': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **hex color** (e.g., #FF5733) or "none" to reset');
              let colorValue = null;
              if (editArgs[0].toLowerCase() !== 'none') {
                const colorInput = editArgs[0].replace('#', '');
                if (!/^[0-9A-Fa-f]{6}$/.test(colorInput)) {
                  return embeds.warn(message, 'Please provide a valid **hex color** (e.g., #FF5733)');
                }
                colorValue = parseInt(colorInput, 16);
              }
              updateData = { color: colorValue };
              successMsg = colorValue ? `Color changed to: #${colorValue.toString(16).toUpperCase().padStart(6, '0')}` : 'Color reset to default';
              break;
            }
            case 'minlevel': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **minimum level** (or "none" to remove)');
              let minLevel = null;
              if (editArgs[0].toLowerCase() !== 'none') {
                minLevel = parseInt(editArgs[0]);
                if (isNaN(minLevel) || minLevel < 1 || minLevel > 1000) {
                  return embeds.warn(message, 'Minimum level must be between **1** and **1000**');
                }
              }
              updateData = { 'requirements.minLevel': minLevel };
              successMsg = minLevel ? `Minimum level set to: **${minLevel}**` : 'Minimum level requirement removed';
              break;
            }
            case 'maxlevel': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **maximum level** (or "none" to remove)');
              let maxLevel = null;
              if (editArgs[0].toLowerCase() !== 'none') {
                maxLevel = parseInt(editArgs[0]);
                if (isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) {
                  return embeds.warn(message, 'Maximum level must be between **1** and **1000**');
                }
              }
              updateData = { 'requirements.maxLevel': maxLevel };
              successMsg = maxLevel ? `Maximum level set to: **${maxLevel}**` : 'Maximum level requirement removed';
              break;
            }
            case 'requiredroles': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide **roles** (or "none" to remove all)');
              if (editArgs[0].toLowerCase() === 'none') {
                updateData = { 'requirements.requiredRoles': [] };
                successMsg = 'Required roles cleared';
              } else {
                const roleIds = [];
                for (const arg of editArgs) {
                  const roleResult = await findRole(message.guild, arg, client);
                  if (roleResult.found) {
                    roleIds.push(roleResult.role.id);
                  }
                }
                if (roleIds.length === 0) {
                  return embeds.warn(message, 'No valid roles found');
                }
                updateData = { 'requirements.requiredRoles': roleIds };
                successMsg = `Required roles set to: ${roleIds.map(r => `<@&${r}>`).join(', ')}`;
              }
              break;
            }
            case 'roles': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide **roles** to award winners (or "none" to remove)');
              if (editArgs[0].toLowerCase() === 'none') {
                updateData = { winnerRoles: [] };
                successMsg = 'Winner roles cleared';
              } else {
                const roleIds = [];
                for (const arg of editArgs) {
                  const roleResult = await findRole(message.guild, arg, client);
                  if (roleResult.found) {
                    roleIds.push(roleResult.role.id);
                  }
                }
                if (roleIds.length === 0) {
                  return embeds.warn(message, 'No valid roles found');
                }
                updateData = { winnerRoles: roleIds };
                successMsg = `Winner roles set to: ${roleIds.map(r => `<@&${r}>`).join(', ')}`;
              }
              break;
            }
            case 'thumbnail': {
              let thumbnailUrl = null;
              if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType?.startsWith('image/')) thumbnailUrl = attachment.url;
                else return embeds.warn(message, 'Attachment must be an **image**');
              } else if (editArgs[0]) {
                if (editArgs[0].toLowerCase() === 'none') thumbnailUrl = null;
                else {
                  try { new URL(editArgs[0]); thumbnailUrl = editArgs[0]; }
                  catch { return embeds.warn(message, 'Please provide a valid **image URL** or attach an image'); }
                }
              } else {
                return embeds.warn(message, 'Please provide an **image URL**, attach an image, or use "none" to remove');
              }
              updateData = { thumbnail: thumbnailUrl };
              successMsg = thumbnailUrl ? 'Thumbnail updated!' : 'Thumbnail removed';
              break;
            }
            case 'age': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide **account age in days** (or "none" to remove)');
              let accountAge = null;
              if (editArgs[0].toLowerCase() !== 'none') {
                accountAge = parseInt(editArgs[0]);
                if (isNaN(accountAge) || accountAge < 1 || accountAge > 365) {
                  return embeds.warn(message, 'Account age must be between **1** and **365** days');
                }
              }
              updateData = { 'requirements.accountAge': accountAge };
              successMsg = accountAge ? `Account age requirement set to: **${accountAge}+ days**` : 'Account age requirement removed';
              break;
            }
            case 'stay': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide **server stay in days** (or "none" to remove)');
              let serverStay = null;
              if (editArgs[0].toLowerCase() !== 'none') {
                serverStay = parseInt(editArgs[0]);
                if (isNaN(serverStay) || serverStay < 1 || serverStay > 365) {
                  return embeds.warn(message, 'Server stay must be between **1** and **365** days');
                }
              }
              updateData = { 'requirements.serverStay': serverStay };
              successMsg = serverStay ? `Server stay requirement set to: **${serverStay}+ days**` : 'Server stay requirement removed';
              break;
            }
            case 'level': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **level requirement** (or "none" to remove)');
              let levelReq = null;
              if (editArgs[0].toLowerCase() !== 'none') {
                const level = parseInt(editArgs[0]);
                if (isNaN(level) || level < 1 || level > 1000) return embeds.warn(message, 'Level requirement must be between **1** and **1000**');
                levelReq = level;
              }
              updateData = { 'requirements.level': levelReq };
              successMsg = `Level requirement set to: ${levelReq ? `Level ${levelReq}+` : 'removed'}`;
              break;
            }
            case 'role': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **role** (or "none" to remove)');
              let roleReq = null;
              if (editArgs[0].toLowerCase() !== 'none') {
                const roleResult = await findRole(message.guild, editArgs[0], client);
                if (!roleResult.found) return embeds.warn(message, roleResult.error);
                roleReq = roleResult.role.id;
              }
              updateData = { 'requirements.roleId': roleReq };
              successMsg = `Role requirement set to: ${roleReq ? `<@&${roleReq}>` : 'removed'}`;
              break;
            }
            case 'host': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **user** to set as the new host');
              const userResult = await findUser(message.guild, editArgs[0], client);
              if (!userResult.found) return embeds.warn(message, userResult.error);
              updateData = { hostId: userResult.user.user.id };
              successMsg = `Host changed to: <@${userResult.user.user.id}>`;
              break;
            }
            case 'description': {
              if (!editArgs[0]) return embeds.warn(message, 'Please provide a **description** for the giveaway');
              const newDesc = editArgs.join(' ');
              if (newDesc.length > 1000) return embeds.warn(message, 'Description must be **1000 characters or less**');
              updateData = { description: newDesc };
              successMsg = 'Description has been updated!';
              break;
            }
            case 'image': {
              let imageUrl = null;
              if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType && attachment.contentType.startsWith('image/')) imageUrl = attachment.url;
                else return embeds.warn(message, 'Attachment must be an **image**');
              } else if (editArgs[0]) {
                if (editArgs[0].toLowerCase() === 'none') imageUrl = null;
                else {
                  try { new URL(editArgs[0]); imageUrl = editArgs[0]; }
                  catch { return embeds.warn(message, 'Please provide a valid **image URL** or attach an image'); }
                }
              } else {
                return embeds.warn(message, 'Please provide an **image URL**, attach an image, or use "none" to remove');
              }
              updateData = { image: imageUrl };
              successMsg = `Image has been ${imageUrl ? 'updated' : 'removed'}!`;
              break;
            }
          }

          const updatedGiveaway = await guildService.updateGiveaway(message.guild.id, giveaway.id, updateData);
          const success = await updateGiveawayMessage(updatedGiveaway, linkData, message.guild);
          if (!success) return embeds.warn(message, 'Failed to update giveaway message');

          return embeds.success(message, `**${giveaway.title}**: ${successMsg}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to update giveaway');
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;
    await ensureGuildData(message.guild.id);

    const guildService = getService('guild');

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'giveaways');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'giveaways');
  }
};
