const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, ApplicationCommandOptionType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureUserData } = require('../../../database');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const logger = require('../../../utils/logger');

// Shared logic for note command
async function handleNoteShared(context, subcommand, content, noteId) {
  const userService = getService('user');
  const isInteraction = !!context.user;
  const user = isInteraction ? context.user : context.author;

  // Ensure user data exists in the database
  await ensureUserData(user.id);

  try {
    if (subcommand === 'add') {
      // Check content length
      if (content.length > 500) {
        return embeds.warn(context, 'Note content must be **500 characters or less**', false);
      }

      if (content.length < 1) {
        return embeds.warn(context, 'Note content cannot be **empty**', false);
      }

      const newNote = await userService.addNote(user.id, content);
      return embeds.success(context, `Created note **#${newNote.id}**: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`, false);

    } else if (subcommand === 'remove') {
      if (!noteId || isNaN(noteId)) {
        return embeds.warn(context, 'Please provide a valid note ID', false);
      }

      const removedNote = await userService.removeNote(user.id, noteId);

      if (removedNote) {
        return embeds.success(context, `Removed note **#${noteId}**`, false);
      } else {
        return embeds.warn(context, `No note found with ID **#${noteId}**`, false);
      }

    } else if (subcommand === 'list') {
      const notes = await userService.getNotes(user.id);

      if (notes && notes.length > 0) {
        const sortedNotes = notes.sort((a, b) => a.id - b.id);

        const formatPage = (pageNotes, currentPage, totalPages) => {
          const notesList = pageNotes.map((note) => {
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

        await createPagination(context, sortedNotes, formatPage, 5, 'Notes');
      } else {
        return embeds.warn(context, 'You have no notes saved', false);
      }

    } else if (subcommand === 'clear') {
      const notes = await userService.getNotes(user.id);

      if (notes && notes.length > 0) {
        await createConfirmation(
          context,
          'Are you sure you want to **remove all notes**?',
          async (interaction) => {
            await userService.clearNotes(user.id);
            const successEmbed = embeds.createSuccess(context, 'Removed all notes');
            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      } else {
        return embeds.warn(context, 'You have no notes to clear', false);
      }
    }
  } catch (error) {
    logger.webhook.error(error, context);
    return embeds.deny(context, 'Failed to process note command', false);
  }
}

module.exports = {
  name: "note",
  aliases: ['notes', 'todo'],
  description: `manage your personal notes`,
  isGroupCommand: true,
  run: async (client, message, args) => {
    if (args[0] === 'add' || args[0] === 'create') {
      if (!args[1]) {
        return runHelpCommand(message, 'note');
      }
      const content = args.slice(1).join(' ');
      return await handleNoteShared(message, 'add', content, null);

    } else if (args[0] === 'remove' || args[0] === 'delete' || args[0] === 'rm' || args[0] === 'del') {
      const noteId = parseInt(args[1]);
      if (!noteId || isNaN(noteId)) {
        return runHelpCommand(message, 'note');
      }
      return await handleNoteShared(message, 'remove', null, noteId);

    } else if (args[0] === 'list' || !args[0]) {
      return await handleNoteShared(message, 'list', null, null);

    } else if (args[0] === 'reset' || args[0] === 'clear') {
      return await handleNoteShared(message, 'clear', null, null);

    } else {
      return runHelpCommand(message, 'note');
    }
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage your personal notes')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new note')
        .addStringOption(option =>
          option
            .setName('content')
            .setDescription('The content of your note')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a note by ID')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('The ID of the note to remove')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all your notes')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clear all your notes')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const content = interaction.options.getString('content');
    const noteId = interaction.options.getInteger('id');

    return await handleNoteShared(interaction, subcommand, content, noteId);
  }
}
