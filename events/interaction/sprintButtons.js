const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { Sprint } = require('../../database/models/sprint');
const config = require('../../config/setup');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle Join button
    if (interaction.isButton() && interaction.customId === 'sprint_join') {
      try {
        // Find active sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: interaction.message.id,
          isActive: true
        });

        if (!sprint) {
          return interaction.reply({
            content: '❌ This sprint is no longer active.',
            ephemeral: true
          });
        }

        // Check if user already joined
        const alreadyJoined = sprint.participants.some(p => p.userId === interaction.user.id);
        if (alreadyJoined) {
          return interaction.reply({
            content: '❌ You have already joined this sprint!',
            ephemeral: true
          });
        }

        // Show modal
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

        const row1 = new ActionRowBuilder().addComponents(bookNameInput);
        const row2 = new ActionRowBuilder().addComponents(startTabInput);

        modal.addComponents(row1, row2);
        await interaction.showModal(modal);

      } catch (error) {
        console.error('[Sprint Join Button] Error:', error);
        return interaction.reply({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true
        }).catch(() => {});
      }
    }

    // Handle Update button
    if (interaction.isButton() && interaction.customId === 'sprint_update') {
      try {
        // Find active sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: interaction.message.id,
          isActive: true
        });

        if (!sprint) {
          return interaction.reply({
            content: '❌ This sprint is no longer active.',
            ephemeral: true
          });
        }

        // Check if user is a participant
        const participant = sprint.participants.find(p => p.userId === interaction.user.id);
        if (!participant) {
          return interaction.reply({
            content: '❌ You are not part of the current sprint!',
            ephemeral: true
          });
        }

        // Show modal
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

        const row = new ActionRowBuilder().addComponents(currentTabInput);
        modal.addComponents(row);

        await interaction.showModal(modal);

      } catch (error) {
        console.error('[Sprint Update Button] Error:', error);
        return interaction.reply({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true
        }).catch(() => {});
      }
    }

    // Handle Join modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('sprint_join_modal_')) {
      try {
        const messageId = interaction.customId.replace('sprint_join_modal_', '');
        const bookName = interaction.fields.getTextInputValue('book_name').trim();
        const startTabStr = interaction.fields.getTextInputValue('start_tab').trim();

        const startTab = parseInt(startTabStr);
        if (isNaN(startTab) || startTab < 0) {
          return interaction.reply({
            content: '❌ Invalid page number. Please enter a valid number.',
            ephemeral: true
          });
        }

        // Find sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: messageId,
          isActive: true
        });

        if (!sprint) {
          return interaction.reply({
            content: '❌ This sprint is no longer active.',
            ephemeral: true
          });
        }

        // Check if already joined
        if (sprint.participants.some(p => p.userId === interaction.user.id)) {
          return interaction.reply({
            content: '❌ You have already joined this sprint!',
            ephemeral: true
          });
        }

        // Add participant
        sprint.participants.push({
          userId: interaction.user.id,
          username: interaction.user.displayName || interaction.user.username,
          bookName: bookName,
          startTab: startTab,
          currentTab: startTab,
          joinedAt: new Date()
        });

        await sprint.save();

        // Update the message
        const updatedEmbed = createSprintEmbed(sprint);
        await interaction.message.edit({ embeds: [updatedEmbed] });

        await interaction.reply({
          content: `✅ You have joined the sprint! Reading **${bookName}** starting at tab ${startTab}.`,
          ephemeral: true
        });

      } catch (error) {
        console.error('[Sprint Join Modal] Error:', error);
        return interaction.reply({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true
        }).catch(() => {});
      }
    }

    // Handle Update modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('sprint_update_modal_')) {
      try {
        const messageId = interaction.customId.replace('sprint_update_modal_', '');
        const currentTabStr = interaction.fields.getTextInputValue('current_tab').trim();

        const currentTab = parseInt(currentTabStr);
        if (isNaN(currentTab) || currentTab < 0) {
          return interaction.reply({
            content: '❌ Invalid page number. Please enter a valid number.',
            ephemeral: true
          });
        }

        // Find sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: messageId,
          isActive: true
        });

        if (!sprint) {
          return interaction.reply({
            content: '❌ This sprint is no longer active.',
            ephemeral: true
          });
        }

        // Find participant
        const participant = sprint.participants.find(p => p.userId === interaction.user.id);
        if (!participant) {
          return interaction.reply({
            content: '❌ You are not part of the current sprint!',
            ephemeral: true
          });
        }

        // Update progress
        const oldTab = participant.currentTab;
        participant.currentTab = currentTab;
        await sprint.save();

        // Update the message
        const updatedEmbed = createSprintEmbed(sprint);
        await interaction.message.edit({ embeds: [updatedEmbed] });

        const progress = currentTab - participant.startTab;
        await interaction.reply({
          content: `✅ Progress updated! ${oldTab} → ${currentTab} (Total progress: ${progress} tabs)`,
          ephemeral: true
        });

      } catch (error) {
        console.error('[Sprint Update Modal] Error:', error);
        return interaction.reply({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
};

/**
 * Create sprint embed
 */
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
