const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/setup');
const { embeds } = require('../../core/embeds');

// Get Sprint model from database
function getSprintModel() {
  const { getModels } = require('../../database');
  const models = getModels();
  return models ? models.Sprint : null;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle Join button
    if (interaction.isButton() && interaction.customId === 'sprint_join') {
      try {
        const Sprint = getSprintModel();
        if (!Sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'Database not ready. Please try again.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Find active sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: interaction.message.id,
          isActive: true
        });

        if (!sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'This sprint is no longer active.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Check if user already joined
        const alreadyJoined = sprint.participants.some(p => p.userId === interaction.user.id);
        if (alreadyJoined) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createDeny(fakeMessage, 'You have already joined this sprint!');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
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
        
        // Log to webhook if available
        if (interaction.client.errorLogger) {
          interaction.client.errorLogger.log(error, 'Sprint Join Button Error', {
            command: 'Sprint Join Button',
            args: `User: ${interaction.user.id} | Guild: ${interaction.guild.id}`,
            error: error.message
          }).catch(() => {});
        }
        
        const fakeMessage = {
          author: interaction.user,
          channel: interaction.channel
        };
        const errorEmbed = embeds.createWarn(fakeMessage, 'An error occurred. Please try again.');
        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }

    // Handle Update button
    if (interaction.isButton() && interaction.customId === 'sprint_update') {
      try {
        const Sprint = getSprintModel();
        if (!Sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'Database not ready. Please try again.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Find active sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: interaction.message.id,
          isActive: true
        });

        if (!sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'This sprint is no longer active.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Check if user is a participant
        const participant = sprint.participants.find(p => p.userId === interaction.user.id);
        if (!participant) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createDeny(fakeMessage, 'You are not part of the current sprint!');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
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
        
        // Log to webhook if available
        if (interaction.client.errorLogger) {
          interaction.client.errorLogger.log(error, 'Sprint Update Button Error', {
            command: 'Sprint Update Button',
            args: `User: ${interaction.user.id} | Guild: ${interaction.guild.id}`,
            error: error.message
          }).catch(() => {});
        }
        
        const fakeMessage = {
          author: interaction.user,
          channel: interaction.channel
        };
        const errorEmbed = embeds.createWarn(fakeMessage, 'An error occurred. Please try again.');
        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }

    // Handle Join modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('sprint_join_modal_')) {
      try {
        const Sprint = getSprintModel();
        if (!Sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'Database not ready. Please try again.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        const messageId = interaction.customId.replace('sprint_join_modal_', '');
        const bookName = interaction.fields.getTextInputValue('book_name').trim();
        const startTabStr = interaction.fields.getTextInputValue('start_tab').trim();

        const startTab = parseInt(startTabStr);
        if (isNaN(startTab) || startTab < 0) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'Invalid page number. Please enter a valid number.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Find sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: messageId,
          isActive: true
        });

        if (!sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'This sprint is no longer active.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Check if already joined
        if (sprint.participants.some(p => p.userId === interaction.user.id)) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createDeny(fakeMessage, 'You have already joined this sprint!');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Add participant
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

        await sprint.save();

        // Update the message
        const updatedEmbed = createSprintEmbed(sprint);
        await interaction.message.edit({ embeds: [updatedEmbed] });

        // Create a fake message object for embeds helper
        const fakeMessage = {
          author: interaction.user,
          channel: interaction.channel
        };

        // Send success using premade embed
        const successEmbed = embeds.createSuccess(fakeMessage, `You have joined the sprint! Reading **${bookName}** starting at tab **${startTab}**.`);
        
        await interaction.reply({
          embeds: [successEmbed],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error('[Sprint Join Modal] Error:', error);
        
        // Log to webhook if available
        if (interaction.client.errorLogger) {
          interaction.client.errorLogger.log(error, 'Sprint Join Modal Error', {
            command: 'Sprint Join Modal',
            args: `User: ${interaction.user.id} | Guild: ${interaction.guild.id}`,
            error: error.message
          }).catch(() => {});
        }
        
        const fakeMessage = {
          author: interaction.user,
          channel: interaction.channel
        };
        const errorEmbed = embeds.createWarn(fakeMessage, 'An error occurred. Please try again.');
        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }

    // Handle Update modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('sprint_update_modal_')) {
      try {
        const Sprint = getSprintModel();
        if (!Sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'Database not ready. Please try again.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        const messageId = interaction.customId.replace('sprint_update_modal_', '');
        const currentTabStr = interaction.fields.getTextInputValue('current_tab').trim();

        let currentTab = parseInt(currentTabStr);
        if (isNaN(currentTab) || currentTab < 0) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'Invalid page number. Please enter a valid number.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Cap at 9999
        if (currentTab > 9999) {
          currentTab = 9999;
        }

        // Find sprint
        const sprint = await Sprint.findOne({
          guildId: interaction.guild.id,
          messageId: messageId,
          isActive: true
        });

        if (!sprint) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createWarn(fakeMessage, 'This sprint is no longer active.');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Find participant
        const participant = sprint.participants.find(p => p.userId === interaction.user.id);
        if (!participant) {
          const fakeMessage = {
            author: interaction.user,
            channel: interaction.channel
          };
          const errorEmbed = embeds.createDeny(fakeMessage, 'You are not part of the current sprint!');
          return interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
          });
        }

        // Update progress
        const oldTab = participant.currentTab;
        participant.currentTab = currentTab;
        await sprint.save();

        // Update the message
        const updatedEmbed = createSprintEmbed(sprint);
        await interaction.message.edit({ embeds: [updatedEmbed] });

        // Create a fake message object for embeds helper
        const fakeMessage = {
          author: interaction.user,
          channel: interaction.channel
        };

        // Send success using premade embed
        const successEmbed = embeds.createSuccess(fakeMessage, `Progress updated! **${oldTab}** → **${currentTab}** tabs now`);

        await interaction.reply({
          embeds: [successEmbed],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error('[Sprint Update Modal] Error:', error);
        
        // Log to webhook if available
        if (interaction.client.errorLogger) {
          interaction.client.errorLogger.log(error, 'Sprint Update Modal Error', {
            command: 'Sprint Update Modal',
            args: `User: ${interaction.user.id} | Guild: ${interaction.guild.id}`,
            error: error.message
          }).catch(() => {});
        }
        
        const fakeMessage = {
          author: interaction.user,
          channel: interaction.channel
        };
        const errorEmbed = embeds.createWarn(fakeMessage, 'An error occurred. Please try again.');
        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral
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