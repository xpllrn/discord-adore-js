const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureUserData } = require('../../../database');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "note",
  aliases: ['notes', 'todo'],
  description: `manage your personal notes`,
  isGroupCommand: true,
  run: async (client, message, args) => {
    const userService = getService('user');

    // Ensure user data exists in the database
    await ensureUserData(message.author.id);

    if (args[0] === 'add' || args[0] === 'create') {
      const subcommandInfo = {
        description: 'Add a new note',
        usage: '{guildprefix}note add [content]',
        aliases: ['create'],
        parameters: ['content'],
        example: '{guildprefix}note add NoNutNovember'
      };

      if (!args[1]) {
        return runHelpCommand(message, 'note');
      }

      const content = args.slice(1).join(' ');

      // Check content length
      if (content.length > 500) {
        return embeds.warn(message, 'Note content must be **500 characters or less**');
      }

      if (content.length < 1) {
        return embeds.warn(message, 'Note content cannot be **empty**');
      }

      try {
        // Add note using service layer
        const newNote = await userService.addNote(message.author.id, content);
        return embeds.success(message, `Created note **#${newNote.id}**: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to create note');
      }

    } else if (args[0] === 'remove' || args[0] === 'delete' || args[0] === 'rm' || args[0] === 'del') {
      const subcommandInfo = {
        description: 'Remove a note by ID',
        usage: '{guildprefix}note remove [id]',
        aliases: ['delete', 'rm', 'del'],
        parameters: ['id'],
        example: '{guildprefix}note remove 1'
      };

      const noteId = parseInt(args[1]);

      if (!noteId || isNaN(noteId)) {
        return runHelpCommand(message, 'note');
      }

      try {
        const removedNote = await userService.removeNote(message.author.id, noteId);

        if (removedNote) {
          return embeds.success(message, `Removed note **#${noteId}**`);
        } else {
          return embeds.warn(message, `No note found with ID **#${noteId}**`);
        }
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to remove note');
      }

    } else if (args[0] === 'list' || !args[0]) {
      const subcommandInfo = {
        description: 'List all your notes',
        usage: '{guildprefix}note list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}note list'
      };

      try {
        const notes = await userService.getNotes(message.author.id);

        if (notes && notes.length > 0) {
          // Sort notes by ID for consistent display
          const sortedNotes = notes.sort((a, b) => a.id - b.id);

          // Format page function for pagination
          const formatPage = (pageNotes, currentPage, totalPages) => {
            const startIndex = (currentPage - 1) * 10;

            const notesList = pageNotes.map((note, index) => {
              const number = note.id.toString().padStart(2, '0');
              const timestamp = `<t:${Math.floor(note.createdAt.getTime() / 1000)}:R>`;
              const content = note.content.length > 100 ?
                note.content.substring(0, 100) + '...' :
                note.content;

              return `\`${number}\` **${content}** ${timestamp}`;
            }).join('\n');

            return new EmbedBuilder()
              .setColor(config.colors.embed)
              .setTitle('Your Notes')
              .setDescription(notesList)
              .setFooter({ text: `${sortedNotes.length} notes • Page ${currentPage}/${totalPages}` });
          };

          // Use pagination system with 10 items per page
          await createPagination(message, sortedNotes, formatPage, 5, 'Notes');
        } else {
          return embeds.warn(message, 'You have no notes saved');
        }
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to retrieve notes');
      }

    } else if (args[0] === 'reset' || args[0] === 'clear') {
      const subcommandInfo = {
        description: 'Clear all your notes',
        usage: '{guildprefix}note reset',
        aliases: ['clear'],
        parameters: [],
        example: '{guildprefix}note reset'
      };

      try {
        const notes = await userService.getNotes(message.author.id);

        if (notes && notes.length > 0) {
          // Show confirmation dialog
          await createConfirmation(
            message,
            'Are you sure you want to **remove all notes**?',
            async (interaction) => {
              // On approve: delete all notes using service layer
              await userService.clearNotes(message.author.id);

              // Edit the confirmation embed to show success message
              const successEmbed = embeds.createSuccess(message, 'Removed all notes');

              await interaction.editReply({ embeds: [successEmbed], components: [] });
            }
          );
        } else {
          return embeds.warn(message, 'You have no notes to clear');
        }
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to clear notes');
      }

    } else {
      return runHelpCommand(message, 'note');
    }
  }
}
