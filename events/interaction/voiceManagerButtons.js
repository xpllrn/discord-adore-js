const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const guildCache = require('../../database/cache/models/guild');
const { colors, emojis } = require('../../config/setup');

/**
 * Safely respond to an interaction, handling expired/invalid interactions
 * @param {Interaction} interaction - The interaction to respond to
 * @param {Object} options - Response options
 * @param {string} method - Method to use ('reply', 'update', 'editReply', 'followUp')
 * @returns {Promise<boolean>} - Whether the response was successful
 */
async function safeInteractionResponse(interaction, options, method = 'reply') {
  try {
    // Check if interaction is still valid
    if (!interaction.isRepliable()) {
      console.warn('VM Interaction is not repliable:', interaction.customId);
      return false;
    }

    // Check if interaction is expired
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 14 * 60 * 1000) { // 14 minutes
      console.warn('VM Interaction expired, cannot respond:', interaction.customId);
      return false;
    }

    // Check interaction state and use appropriate method
    if (method === 'reply' && (interaction.replied || interaction.deferred)) {
      console.warn('VM Interaction already replied/deferred, using editReply instead');
      method = 'editReply';
    }

    switch (method) {
      case 'reply':
        await interaction.reply(options);
        break;
      case 'update':
        await interaction.update(options);
        break;
      case 'editReply':
        await interaction.editReply(options);
        break;
      case 'followUp':
        await interaction.followUp(options);
        break;
      case 'showModal':
        await interaction.showModal(options);
        break;
      default:
        await interaction.reply(options);
    }

    return true;
  } catch (error) {
    // Handle specific Discord API errors
    if (error.code === 10062) { // Unknown interaction
      // Silent fail for expired interactions
    } else if (error.code === 40060) { // Interaction has already been acknowledged
      // Silent fail for already acknowledged interactions
    } else {
      // Send error to webhook for other VM interaction errors
      if (interaction.client?.errorLogger) {
        interaction.client.errorLogger.log(error, 'Voice Manager Interaction', {
          command: 'Voice Manager Button',
          args: `CustomId: ${interaction.customId || 'Unknown'}`,
          user: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel
        });
      }
    }
    return false;
  }
}

module.exports = {
  name: 'voiceManagerButtons',
  
  async handleVMButton(interaction) {
    try {
      if (!interaction.customId.startsWith('vm_')) return false;

      // Check if interaction is still valid
      if (interaction.replied || interaction.deferred) {
        console.warn('Voice manager interaction already handled:', interaction.customId);
        return false;
      }

      const action = interaction.customId.replace('vm_', '');

      // Handle rename separately since it needs to show a modal immediately
      if (action === 'rename') {
        return await this.handleRenameButton(interaction);
      }

      // For all other actions, validate first then reply immediately
      const member = interaction.member;
      if (!member.voice.channel) {
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'You need to be in a voice channel to use this command');
        return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const voiceManager = await guildCache.getVoiceManager(interaction.guild.id);
      if (!voiceManager || !voiceManager.enabled) {
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Voice manager is not setup in this server');
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const tempChannel = await guildCache.getTempVoiceChannel(interaction.guild.id, member.voice.channel.id);
      if (!tempChannel) {
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'You can only use voice manager commands in temporary voice channels');
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // Check ownership for most commands (except claim and info)
      if (!['claim', 'info'].includes(action) && tempChannel.ownerId !== member.id) {
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Only the channel owner can use this command');
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      switch (action) {
        case 'lock':
          return await handleLock(interaction, tempChannel);
        case 'unlock':
          return await handleUnlock(interaction, tempChannel);
        case 'hide':
          return await handleHide(interaction, tempChannel);
        case 'unhide':
          return await handleUnhide(interaction, tempChannel);
        case 'claim':
          return await handleClaim(interaction, tempChannel);
        case 'increase':
          return await handleIncrease(interaction, tempChannel);
        case 'decrease':
          return await handleDecrease(interaction, tempChannel);
        case 'delete':
          return await handleDelete(interaction, tempChannel);
        case 'info':
          return await handleInfo(interaction, tempChannel);
        default:
          const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Unknown voice manager action');
          return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      console.error('Error in voice manager button handler:', error);

      // Try to respond with an error message using safe response
      const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'An error occurred while processing your request. Please try again.');
      await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });

      return false;
    }
  },

  async handleRenameButton(interaction) {
    // Validate without deferring reply
    const member = interaction.member;
    if (!member.voice.channel) {
      return await interaction.reply({
        content: '❌ You need to be in a voice channel to use this command',
        flags: MessageFlags.Ephemeral
      });
    }

    const voiceManager = await guildCache.getVoiceManager(interaction.guild.id);
    if (!voiceManager || !voiceManager.enabled) {
      return await interaction.reply({
        content: '❌ Voice manager is not setup in this server',
        flags: MessageFlags.Ephemeral
      });
    }

    const tempChannel = await guildCache.getTempVoiceChannel(interaction.guild.id, member.voice.channel.id);
    if (!tempChannel) {
      return await interaction.reply({
        content: '❌ You can only use voice manager commands in temporary voice channels',
        flags: MessageFlags.Ephemeral
      });
    }

    if (tempChannel.ownerId !== member.id) {
      return await interaction.reply({
        content: '❌ Only the channel owner can rename the channel',
        flags: MessageFlags.Ephemeral
      });
    }

    // Show the modal
    const modal = new ModalBuilder()
      .setCustomId('vm_rename_modal')
      .setTitle('Rename Voice Channel');

    const nameInput = new TextInputBuilder()
      .setCustomId('channel_name')
      .setLabel('New Channel Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter new channel name...')
      .setRequired(true)
      .setMaxLength(100);

    const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
    modal.addComponents(firstActionRow);

    const success = await safeInteractionResponse(interaction, modal, 'showModal');
    return success;
  }
};

async function handleLock(interaction, tempChannel) {
  if (tempChannel.settings.locked) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Your voice channel is already locked');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      Connect: false,
      // Keep other permissions intact
      ViewChannel: true,
      Speak: true,
      Stream: true,
      UseVAD: true
    });

    await guildCache.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
      locked: true
    });

    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, 'Locked your voice channel');
    return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to lock the voice channel. Please check my permissions.');
    return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleUnlock(interaction, tempChannel) {
  if (!tempChannel.settings.locked) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Your voice channel is not locked');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      Connect: true,
      // Ensure all voice permissions are restored
      ViewChannel: true,
      Speak: true,
      Stream: true,
      UseVAD: true
    });

    await guildCache.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
      locked: false
    });

    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, 'Unlocked your voice channel');
    return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to unlock the voice channel. Please check my permissions.');
    return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleHide(interaction, tempChannel) {
  if (tempChannel.settings.hidden) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Your voice channel is already hidden');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      ViewChannel: false
    });

    await guildCache.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
      hidden: true
    });

    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, 'Hidden your voice channel');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to hide the voice channel. Please check my permissions.');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleUnhide(interaction, tempChannel) {
  if (!tempChannel.settings.hidden) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Your voice channel is not hidden');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      ViewChannel: true,
      // Ensure all voice permissions are restored when unhiding
      Connect: true,
      Speak: true,
      Stream: true,
      UseVAD: true
    });

    await guildCache.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
      hidden: false
    });

    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, 'Unhidden your voice channel');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to unhide the voice channel. Please check my permissions.');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}


async function handleClaim(interaction, tempChannel) {
  // Check if current owner is still in the channel
  const currentOwner = interaction.guild.members.cache.get(tempChannel.ownerId);
  if (currentOwner && currentOwner.voice.channel && currentOwner.voice.channel.id === tempChannel.channelId) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Cannot claim this channel while the owner is still present');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  try {
    await guildCache.transferVoiceChannelOwnership(interaction.guild.id, tempChannel.channelId, interaction.user.id);
    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, 'You have claimed ownership of this voice channel');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to claim ownership');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleIncrease(interaction, tempChannel) {
  const currentLimit = tempChannel.settings.userLimit || 0;
  const newLimit = currentLimit === 0 ? 2 : Math.min(currentLimit + 1, 99);

  try {
    await interaction.member.voice.channel.setUserLimit(newLimit);
    await guildCache.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
      userLimit: newLimit
    });

    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, `Increased user limit to **${newLimit}**`);
    return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to increase user limit. Please check my permissions.');
    return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDecrease(interaction, tempChannel) {
  const currentLimit = tempChannel.settings.userLimit || 0;
  if (currentLimit <= 1) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'User limit is already at minimum (1) or unlimited (0)');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const newLimit = currentLimit - 1;

  try {
    await interaction.member.voice.channel.setUserLimit(newLimit);
    await guildCache.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
      userLimit: newLimit
    });

    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, `Decreased user limit to **${newLimit}**`);
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to decrease user limit. Please check my permissions.');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDelete(interaction, tempChannel) {
  try {
    // Respond to the interaction first before deleting the channel
    const success = await safeInteractionResponse(interaction, {
      content: '🗑️ **Voice channel is being deleted...**',
      flags: MessageFlags.Ephemeral
    });

    if (!success) {
      console.warn('Failed to respond to delete interaction, channel may still be deleted');
    }

    // Remove from database
    await guildCache.removeTempVoiceChannel(interaction.guild.id, tempChannel.channelId);

    // Delete the channel after a short delay to ensure the response is sent
    setTimeout(async () => {
      try {
        await interaction.member.voice.channel.delete('Voice channel deleted by owner');
      } catch (deleteError) {
        console.error('Error deleting voice channel:', deleteError);
      }
    }, 1000);

    return true;
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to delete the voice channel. Please check my permissions.');
    return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleInfo(interaction, tempChannel) {
  const channel = interaction.member.voice.channel;
  const owner = interaction.guild.members.cache.get(tempChannel.ownerId);
  const createdTime = Math.floor(new Date(tempChannel.createdAt).getTime() / 1000);

  const infoEmbed = new EmbedBuilder()
    .setTitle(`${channel.name}`)
    .addFields([
      { name: 'Owner', value: owner ? `${owner.displayName} (${owner.id})` : 'Unknown', inline: true },
      { name: 'Locked', value: tempChannel.settings.locked ? emojis.success : emojis.error, inline: true },
      { name: 'Created', value: `<t:${createdTime}:R>`, inline: true },
      { name: 'Bitrate', value: `${channel.bitrate / 1000}kbps`, inline: true },
      { name: 'Connected', value: `${channel.members.size}`, inline: true }
    ])
    .setColor(colors.embed);

  return await interaction.reply({ embeds: [infoEmbed], flags: MessageFlags.Ephemeral });
}
