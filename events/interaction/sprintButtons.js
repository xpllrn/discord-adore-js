const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/setup');
const { embeds } = require('../../core/embeds');

async function getGuildWithSprints(guildId) {
  const { getModels } = require('../../database');
  const models = getModels();
  if (!models || !models.Guild) return null;
  
  return await models.Guild.findOne({ GuildID: guildId });
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle Join button
    if (interaction.isButton() && interaction.customId === 'sprint_join') {
      try {
        const guildData = await getGuildWithSprints(interaction.guild.id);
        if (!guildData) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'Database not ready. Please try again.')],
            flags: MessageFlags.Ephemeral
          });
        }

        const sprint = guildData.Sprints.find(s => s.messageId === interaction.message.id && s.isActive);

        if (!sprint) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'This sprint is no longer active.')],
            flags: MessageFlags.Ephemeral
          });
        }

        if (sprint.participants.some(p => p.userId === interaction.user.id)) {
          return interaction.reply({
            embeds: [embeds.createDeny({ author: interaction.user, channel: interaction.channel }, 'You have already joined this sprint!')],
            flags: MessageFlags.Ephemeral
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`sprint_join_modal_${interaction.message.id}`)
          .setTitle('Join Reading Sprint');

        const bookNameInput = new TextInputBuilder()
          .setCustomId('book_name')
          .setLabel('Book Name')
          .setPlaceholder('Enter the book you are reading')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        const startTabInput = new TextInputBuilder()
          .setCustomId('start_tab')
          .setLabel('Starting Tab/Page Number')
          .setPlaceholder('Enter your starting page number')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(10);

        modal.addComponents(
          new ActionRowBuilder().addComponents(bookNameInput),
          new ActionRowBuilder().addComponents(startTabInput)
        );

        await interaction.showModal(modal);

      } catch (error) {
        console.error('[Sprint Join Button] Error:', error);
        return interaction.reply({
          embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'An error occurred. Please try again.')],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }

    // Handle Update button
    if (interaction.isButton() && interaction.customId === 'sprint_update') {
      try {
        const guildData = await getGuildWithSprints(interaction.guild.id);
        if (!guildData) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'Database not ready. Please try again.')],
            flags: MessageFlags.Ephemeral
          });
        }

        const sprint = guildData.Sprints.find(s => s.messageId === interaction.message.id && s.isActive);

        if (!sprint) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'This sprint is no longer active.')],
            flags: MessageFlags.Ephemeral
          });
        }

        const participant = sprint.participants.find(p => p.userId === interaction.user.id);
        if (!participant) {
          return interaction.reply({
            embeds: [embeds.createDeny({ author: interaction.user, channel: interaction.channel }, 'You are not part of the current sprint!')],
            flags: MessageFlags.Ephemeral
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`sprint_update_modal_${interaction.message.id}`)
          .setTitle('Update Reading Progress');

        const currentTabInput = new TextInputBuilder()
          .setCustomId('current_tab')
          .setLabel('Current Tab/Page Number')
          .setPlaceholder(`Current: ${participant.currentTab}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(10);

        modal.addComponents(new ActionRowBuilder().addComponents(currentTabInput));
        await interaction.showModal(modal);

      } catch (error) {
        console.error('[Sprint Update Button] Error:', error);
        return interaction.reply({
          embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'An error occurred. Please try again.')],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }


    // Handle Join modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('sprint_join_modal_')) {
      try {
        const guildData = await getGuildWithSprints(interaction.guild.id);
        if (!guildData) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'Database not ready. Please try again.')],
            flags: MessageFlags.Ephemeral
          });
        }

        const messageId = interaction.customId.replace('sprint_join_modal_', '');
        const bookName = interaction.fields.getTextInputValue('book_name').trim();
        const startTabStr = interaction.fields.getTextInputValue('start_tab').trim();

        const startTab = parseInt(startTabStr);
        if (isNaN(startTab) || startTab < 0) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'Invalid page number. Please enter a valid number.')],
            flags: MessageFlags.Ephemeral
          });
        }

        const sprint = guildData.Sprints.find(s => s.messageId === messageId && s.isActive);

        if (!sprint) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'This sprint is no longer active.')],
            flags: MessageFlags.Ephemeral
          });
        }

        if (sprint.participants.some(p => p.userId === interaction.user.id)) {
          return interaction.reply({
            embeds: [embeds.createDeny({ author: interaction.user, channel: interaction.channel }, 'You have already joined this sprint!')],
            flags: MessageFlags.Ephemeral
          });
        }

        sprint.participants.push({
          userId: interaction.user.id,
          username: interaction.user.displayName || interaction.user.username,
          bookName: bookName,
          startTab: startTab,
          currentTab: startTab,
          joinedAt: new Date(),
          isPaused: false,
          totalPausedTime: 0,
          lastPauseTime: null
        });

        await guildData.save();

        const updatedEmbed = createSprintEmbed(sprint);
        await interaction.message.edit({ embeds: [updatedEmbed] });

        await interaction.reply({
          embeds: [embeds.createSuccess({ author: interaction.user, channel: interaction.channel }, `You have joined the sprint! Reading **${bookName}** starting at tab **${startTab}**.`)],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error('[Sprint Join Modal] Error:', error);
        return interaction.reply({
          embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'An error occurred. Please try again.')],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }

    // Handle Update modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('sprint_update_modal_')) {
      try {
        const guildData = await getGuildWithSprints(interaction.guild.id);
        if (!guildData) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'Database not ready. Please try again.')],
            flags: MessageFlags.Ephemeral
          });
        }

        const messageId = interaction.customId.replace('sprint_update_modal_', '');
        const currentTabStr = interaction.fields.getTextInputValue('current_tab').trim();

        let currentTab = parseInt(currentTabStr);
        if (isNaN(currentTab) || currentTab < 0) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'Invalid page number. Please enter a valid number.')],
            flags: MessageFlags.Ephemeral
          });
        }

        if (currentTab > 9999) {
          currentTab = 9999;
        }

        const sprint = guildData.Sprints.find(s => s.messageId === messageId && s.isActive);

        if (!sprint) {
          return interaction.reply({
            embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'This sprint is no longer active.')],
            flags: MessageFlags.Ephemeral
          });
        }

        const participant = sprint.participants.find(p => p.userId === interaction.user.id);
        if (!participant) {
          return interaction.reply({
            embeds: [embeds.createDeny({ author: interaction.user, channel: interaction.channel }, 'You are not part of the current sprint!')],
            flags: MessageFlags.Ephemeral
          });
        }

        const oldTab = participant.currentTab;
        participant.currentTab = currentTab;
        await guildData.save();

        const updatedEmbed = createSprintEmbed(sprint);
        await interaction.message.edit({ embeds: [updatedEmbed] });

        await interaction.reply({
          embeds: [embeds.createSuccess({ author: interaction.user, channel: interaction.channel }, `Progress updated! **${oldTab}** → **${currentTab}** tabs now`)],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error('[Sprint Update Modal] Error:', error);
        return interaction.reply({
          embeds: [embeds.createWarn({ author: interaction.user, channel: interaction.channel }, 'An error occurred. Please try again.')],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }
  }
};

function createSprintEmbed(sprint) {
  const title = sprint.name ? `READING SPRINT: ${sprint.name.toUpperCase()}` : 'READING SPRINT STARTED!';

  let description = `**Start Time:** <t:${Math.floor(sprint.startTime.getTime() / 1000)}:F> (<t:${Math.floor(sprint.startTime.getTime() / 1000)}:R>)\n`;
  description += `**End Time:** <t:${Math.floor(sprint.endTime.getTime() / 1000)}:F> (<t:${Math.floor(sprint.endTime.getTime() / 1000)}:R>)\n\n`;

  if (sprint.participants.length === 0) {
    description += '**Present Attendees**\nNo participants yet. Click **Join** to participate!';
  } else {
    description += '**Present Attendees**\n';
    sprint.participants.forEach((p, index) => {
      description += `\`${String(index + 1).padStart(2, '0')}\` **${p.username}**: Tab \`${p.currentTab}\` of **${p.bookName}**\n`;
    });
  }

  return new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle(title)
    .setDescription(description);
}
