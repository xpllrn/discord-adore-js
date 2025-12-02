const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
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
    // This function handles all button interactions with the customId prefix 'vm_' or the new hash IDs.
    try {
      // Map new button IDs to actions
      const buttonIdMap = {
        '6800f9e6e8394c5cfd7b8c7f684b6cd2': 'lock',
        'bc719b5197e94fb68e1db816f8fb00e6': 'unlock',
        '8a7385beb791449f9a7893ed5536e7e3': 'hide',
        '4da0c243b63143d4a574d30c806e962b': 'unhide',
        '0c34acff106f453d84e4ba7122f868a5': 'kick',
        '2c8e65c78329459ee077b3c0e853e4a2': 'claim',
        'f33fa78ce7964964cd5c155b5a15ebb7': 'transfer',
        'd0f359515fe244b0ad8824fb3c066d4b': 'increase',
        '7f5598b8836e442ccd33a88afc00865c': 'decrease',
        '48e538acf6e741aadc391f9d36977473': 'rename'
      };

      // Check if it's a new button ID or old vm_ prefix
      let action;
      if (buttonIdMap[interaction.customId]) {
        action = buttonIdMap[interaction.customId];
      } else if (interaction.customId.startsWith('vm_')) {
        action = interaction.customId.replace('vm_', '');
      } else {
        return false;
      }

      // Check if interaction is still valid
      if (interaction.replied || interaction.deferred) {
        console.warn('Voice manager interaction already handled:', interaction.customId);
        return false;
      }

      // Handle rename separately since it needs to show a modal immediately
      if (action === 'rename') {
        return await this.handleRenameButton(interaction);
      }

      // For all other actions, validate first then reply immediately
      const guildService = getService('guild');
      const member = interaction.member;
      if (!member.voice.channel) {
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'You need to be in a voice channel to use this command');
        return await safeInteractionResponse(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const voiceManager = await guildService.getVoiceManager(interaction.guild.id);
      if (!voiceManager || !voiceManager.enabled) {
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Voice manager is not setup in this server');
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const tempChannel = await guildService.getTempVoiceChannel(interaction.guild.id, member.voice.channel.id);
      if (!tempChannel) {
        const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'You can only use voice manager commands in temporary voice channels');
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // Check ownership for most commands (except claim)
      if (!['claim'].includes(action) && tempChannel.ownerId !== member.id) {
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
        case 'increase':
          return await handleIncrease(interaction, tempChannel);
        case 'decrease':
          return await handleDecrease(interaction, tempChannel);
        case 'kick':
          return await handleKick(interaction, tempChannel);
        case 'claim':
          return await handleClaim(interaction, tempChannel);
        case 'transfer':
          return await handleTransfer(interaction, tempChannel);
        case 'rename':
          return await this.handleRenameButton(interaction);
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
    const guildService = getService('guild');
    const member = interaction.member;
    if (!member.voice.channel) {
      return await interaction.reply({
        content: '❌ You need to be in a voice channel to use this command',
        flags: MessageFlags.Ephemeral
      });
    }

    const voiceManager = await guildService.getVoiceManager(interaction.guild.id);
    if (!voiceManager || !voiceManager.enabled) {
      return await interaction.reply({
        content: '❌ Voice manager is not setup in this server',
        flags: MessageFlags.Ephemeral
      });
    }

    const tempChannel = await guildService.getTempVoiceChannel(interaction.guild.id, member.voice.channel.id);
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
  const guildService = getService('guild');
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

    await guildService.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
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
  const guildService = getService('guild');
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

    await guildService.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
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
  const guildService = getService('guild');
  if (tempChannel.settings.hidden) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Your voice channel is already hidden');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.member.voice.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      ViewChannel: false
    });

    await guildService.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
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
  const guildService = getService('guild');
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

    await guildService.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
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
  const guildService = getService('guild');
  // Check if current owner is still in the channel
  const currentOwner = interaction.guild.members.cache.get(tempChannel.ownerId);
  if (currentOwner && currentOwner.voice.channel && currentOwner.voice.channel.id === tempChannel.channelId) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Cannot claim this channel while the owner is still present');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  try {
    await guildService.transferVoiceChannelOwnership(interaction.guild.id, tempChannel.channelId, interaction.user.id);
    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, 'You have claimed ownership of this voice channel');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to claim ownership');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleIncrease(interaction, tempChannel) {
  const guildService = getService('guild');
  const currentLimit = tempChannel.settings.userLimit || 0;
  const newLimit = currentLimit === 0 ? 2 : Math.min(currentLimit + 1, 99);

  try {
    await interaction.member.voice.channel.setUserLimit(newLimit);
    await guildService.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
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
  const guildService = getService('guild');
  const currentLimit = tempChannel.settings.userLimit || 0;
  if (currentLimit <= 1) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'User limit is already at minimum (1) or unlimited (0)');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const newLimit = currentLimit - 1;

  try {
    await interaction.member.voice.channel.setUserLimit(newLimit);
    await guildService.updateTempVoiceChannel(interaction.guild.id, tempChannel.channelId, {
      userLimit: newLimit
    });

    const embed = embeds.createSuccess({ author: { id: interaction.user.id } }, `Decreased user limit to **${newLimit}**`);
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    const embed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to decrease user limit. Please check my permissions.');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleKick(interaction, tempChannel) {
  const channel = interaction.member.voice.channel;
  const members = channel.members.filter(m => m.id !== interaction.user.id && !m.user.bot);

  if (members.size === 0) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'There are no members to kick from your voice channel');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Create a list of members to kick
  const memberList = members.map((m, i) => `${i + 1}. ${m.displayName}`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(colors.info)
    .setDescription(`${emojis.warn} <@${interaction.user.id}>: Reply with the number of the member you want to kick:\n\n${memberList}\n\nType \`cancel\` to cancel.`)
    .setFooter({ text: 'You have 30 seconds to respond' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

  // Create message collector
  const filter = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

  collector.on('collect', async (msg) => {
    try {
      await msg.delete().catch(() => {});

      if (msg.content.toLowerCase() === 'cancel') {
        const cancelEmbed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Kick cancelled');
        return await interaction.editReply({ embeds: [cancelEmbed] });
      }

      const index = parseInt(msg.content) - 1;
      if (isNaN(index) || index < 0 || index >= members.size) {
        const errorEmbed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Invalid number. Please try again.');
        return await interaction.editReply({ embeds: [errorEmbed] });
      }

      const targetMember = Array.from(members.values())[index];
      await targetMember.voice.disconnect('Kicked by channel owner');

      const successEmbed = embeds.createSuccess({ author: { id: interaction.user.id } }, `Kicked **${targetMember.displayName}** from your voice channel`);
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      const errorEmbed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to kick the member');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Kick timed out');
      await interaction.editReply({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  });
}

async function handleTransfer(interaction, tempChannel) {
  const guildService = getService('guild');
  const channel = interaction.member.voice.channel;
  const members = channel.members.filter(m => m.id !== interaction.user.id && !m.user.bot);

  if (members.size === 0) {
    const embed = embeds.createWarn({ author: { id: interaction.user.id } }, 'There are no members to transfer ownership to');
    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Create a list of members to transfer to
  const memberList = members.map((m, i) => `${i + 1}. ${m.displayName}`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(colors.info)
    .setDescription(`${emojis.warn} <@${interaction.user.id}>: Reply with the number of the member you want to transfer ownership to:\n\n${memberList}\n\nType \`cancel\` to cancel.`)
    .setFooter({ text: 'You have 30 seconds to respond' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

  // Create message collector
  const filter = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

  collector.on('collect', async (msg) => {
    try {
      await msg.delete().catch(() => {});

      if (msg.content.toLowerCase() === 'cancel') {
        const cancelEmbed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Transfer cancelled');
        return await interaction.editReply({ embeds: [cancelEmbed] });
      }

      const index = parseInt(msg.content) - 1;
      if (isNaN(index) || index < 0 || index >= members.size) {
        const errorEmbed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Invalid number. Please try again.');
        return await interaction.editReply({ embeds: [errorEmbed] });
      }

      const targetMember = Array.from(members.values())[index];
      await guildService.transferVoiceChannelOwnership(interaction.guild.id, tempChannel.channelId, targetMember.id);

      const successEmbed = embeds.createSuccess({ author: { id: interaction.user.id } }, `Voice channel ownership transferred to **${targetMember.displayName}**`);
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      const errorEmbed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to transfer ownership');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Transfer timed out');
      await interaction.editReply({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  });
}

async function handleActivity(interaction, tempChannel) {
  const activities = [
    { name: 'Watch Together', value: '880218394199220334' },
    { name: 'Poker Night', value: '755827207812677713' },
    { name: 'Betrayal.io', value: '773336526917861400' },
    { name: 'Fishington.io', value: '814288819477020702' },
    { name: 'Chess In The Park', value: '832012774040141894' },
    { name: 'Sketch Heads', value: '902271654783242291' },
    { name: 'Blazing 8s', value: '832025144389533716' },
    { name: 'Land-io', value: '903769130790969345' },
    { name: 'Putt Party', value: '945737671223947305' },
    { name: 'Bobble League', value: '947957217959759964' }
  ];

  const activityList = activities.map((a, i) => `${i + 1}. ${a.name}`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(colors.info)
    .setDescription(`${emojis.warn} <@${interaction.user.id}>: Reply with the number of the activity you want to start:\n\n${activityList}\n\nType \`cancel\` to cancel.`)
    .setFooter({ text: 'You have 30 seconds to respond' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

  // Create message collector
  const filter = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

  collector.on('collect', async (msg) => {
    try {
      await msg.delete().catch(() => {});

      if (msg.content.toLowerCase() === 'cancel') {
        const cancelEmbed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Activity cancelled');
        return await interaction.editReply({ embeds: [cancelEmbed] });
      }

      const index = parseInt(msg.content) - 1;
      if (isNaN(index) || index < 0 || index >= activities.length) {
        const errorEmbed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Invalid number. Please try again.');
        return await interaction.editReply({ embeds: [errorEmbed] });
      }

      const activity = activities[index];
      const channel = interaction.member.voice.channel;

      // Create activity invite
      const invite = await channel.createInvite({
        maxAge: 0,
        maxUses: 0,
        targetApplication: activity.value,
        targetType: 2
      });

      const successEmbed = new EmbedBuilder()
        .setColor(colors.success)
        .setDescription(`${emojis.success} <@${interaction.user.id}>: Started **${activity.name}**!\n\n[Click here to join](${invite.url})`);

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Activity error:', error);
      const errorEmbed = embeds.createDeny({ author: { id: interaction.user.id } }, 'Failed to start the activity. Make sure I have the correct permissions.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = embeds.createWarn({ author: { id: interaction.user.id } }, 'Activity selection timed out');
      await interaction.editReply({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  });
}

async function handleDelete(interaction, tempChannel) {
  try {
    const guildService = getService('guild');
    // Respond to the interaction first before deleting the channel
    const success = await safeInteractionResponse(interaction, {
      content: '🗑️ **Voice channel is being deleted...**',
      flags: MessageFlags.Ephemeral
    });

    if (!success) {
      console.warn('Failed to respond to delete interaction, channel may still be deleted');
    }

    // Remove from database
    await guildService.removeTempVoiceChannel(interaction.guild.id, tempChannel.channelId);

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
