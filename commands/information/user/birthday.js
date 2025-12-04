const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { findUser } = require('../../../handlers/finder');
const { ensureUserData } = require('../../../database');
const { createPagination } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: "bday",
  aliases: ['birthday'],
  description: `manage birthday settings`,
  syntax: 'bday (subcommand)',
  example: 'bday set 15 March',
  isGroupCommand: true,

  subcommands: {
    set: {
      name: 'set',
      aliases: [],
      description: 'Set your birthday (can only be set once)',
      syntax: '{guildprefix}bday set [day] [month]',
      parameters: ['day', 'month'],
      example: '{guildprefix}bday set 15 March',

      handler: async (client, message, args, userService) => {
        if (!args[0] || !args[1]) {
          return embeds.warn(message, 'Please provide both day and month. Example: `,bday set 15 March`');
        }

        const day = parseInt(args[0]);
        const monthInput = args[1].toLowerCase();

        if (isNaN(day) || day < 1 || day > 31) {
          return embeds.warn(message, 'Day must be a number between **1** and **31**');
        }

        const monthNames = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ];
        const monthShort = [
          'jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
        ];

        let month;
        if (!isNaN(monthInput)) {
          month = parseInt(monthInput);
          if (month < 1 || month > 12) {
            return embeds.warn(message, 'Month must be a number between **1** and **12**');
          }
        } else {
          const monthIndex = monthNames.indexOf(monthInput) !== -1 ?
            monthNames.indexOf(monthInput) :
            monthShort.indexOf(monthInput);

          if (monthIndex === -1) {
            return embeds.warn(message, 'Invalid month. Use month name (e.g., March) or number (1-12)');
          }
          month = monthIndex + 1;
        }

        if ((month === 2 && day > 29) ||
          ([4, 6, 9, 11].includes(month) && day > 30)) {
          return embeds.warn(message, 'Invalid day for the specified month');
        }

        await ensureUserData(message.author.id);

        try {
          const existingBirthday = await userService.getBirthday(message.author.id);

          if (existingBirthday && existingBirthday.day && existingBirthday.month) {
            const formattedBirthday = await userService.getFormattedBirthday(message.author.id);
            return embeds.warn(message, `You already have a birthday set to **${formattedBirthday}**. Birthdays cannot be changed once set.`);
          }

          await userService.setBirthday(message.author.id, day, month);
          const formattedBirthday = await userService.getFormattedBirthday(message.author.id);
          return embeds.success(message, `Set your birthday to **${formattedBirthday}**`);
        } catch (error) {
          throw error;
        }
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all birthdays in the server',
      syntax: '{guildprefix}bday list',
      parameters: [],
      example: '{guildprefix}bday list',

      handler: async (client, message, args, userService) => {
        try {
          const guildMembers = await message.guild.members.fetch();
          const birthdayData = [];

          for (const [userId, member] of guildMembers) {
            try {
              const birthday = await userService.getBirthday(userId);
              if (birthday && birthday.day && birthday.month) {
                const formattedBirthday = await userService.getFormattedBirthday(userId);
                const isBirthdayToday = await userService.isBirthday(userId);
                const nextBirthdayTimestamp = await getNextBirthdayTimestamp(userId);

                birthdayData.push({
                  member,
                  birthday,
                  formattedBirthday,
                  isBirthdayToday,
                  nextBirthdayTimestamp,
                  sortKey: `${birthday.month.toString().padStart(2, '0')}-${birthday.day.toString().padStart(2, '0')}`
                });
              }
            } catch (error) {
              continue;
            }
          }

          if (birthdayData.length === 0) {
            return embeds.warn(message, 'No birthdays found in this server');
          }

          const today = new Date();
          const currentMonth = today.getMonth() + 1;
          const currentDay = today.getDate();
          const currentSortKey = `${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;

          birthdayData.sort((a, b) => {
            if (a.isBirthdayToday && !b.isBirthdayToday) return -1;
            if (!a.isBirthdayToday && b.isBirthdayToday) return 1;
            if (a.isBirthdayToday && b.isBirthdayToday) return 0;

            const aIsUpcoming = a.sortKey >= currentSortKey;
            const bIsUpcoming = b.sortKey >= currentSortKey;

            if (aIsUpcoming && !bIsUpcoming) return -1;
            if (!aIsUpcoming && bIsUpcoming) return 1;

            return a.sortKey.localeCompare(b.sortKey);
          });

          const formatPage = (pageBirthdays, currentPage, totalPages) => {
            const startIndex = (currentPage - 1) * 10;

            const birthdayList = pageBirthdays.map((data, index) => {
              const number = (startIndex + index + 1).toString().padStart(2, '0');
              const displayName = data.member.displayName;

              if (data.isBirthdayToday) {
                return `\`${number}\` 🎂 **${displayName}** - ${data.formattedBirthday} **(Today!)**`;
              } else {
                return `\`${number}\` **${displayName}** - \`${data.formattedBirthday}\` (<t:${data.nextBirthdayTimestamp}:R>)`;
              }
            }).join('\n');

            const entryText = birthdayData.length === 1 ? 'birthday' : 'birthdays';

            return new EmbedBuilder()
              .setColor(config.colors.embed)
              .setTitle('🎂 Server Birthdays')
              .setDescription(birthdayList)
              .setFooter({ text: `${birthdayData.length} ${entryText} || page ${currentPage}/${totalPages}` });
          };

          await createPagination(message, birthdayData, formatPage, 10, 'Server Birthdays');

        } catch (error) {
          throw error;
        }
      }
    },

    view: {
      name: 'view',
      aliases: [],
      description: 'View a user\'s birthday',
      syntax: '{guildprefix}bday (user)',
      parameters: ['user (optional)'],
      example: '{guildprefix}bday @user',

      handler: async (client, message, args, userService) => {
        if (!args[0]) {
          return embeds.warn(message, 'Please mention a user. Example: `,bday @user`');
        }

        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        let targetUser, targetMember;
        if (userResult.isGlobal) {
          targetUser = userResult.user;
          targetMember = null;
        } else {
          targetUser = userResult.user.user || userResult.user;
          targetMember = userResult.user;
        }

        try {
          const formattedBirthday = await userService.getFormattedBirthday(targetUser.id);
          const username = targetMember ? targetMember.displayName : targetUser.username;

          if (!formattedBirthday) {
            return embeds.info(message, `🎂 **${username}** has no birthday set`);
          }

          const isBirthdayToday = await userService.isBirthday(targetUser.id);

          if (isBirthdayToday) {
            const birthdayText = `🎂 **${username}**'s birthday is **${formattedBirthday}** (Today!)`;
            return embeds.info(message, birthdayText);
          } else {
            const nextBirthdayTimestamp = await getNextBirthdayTimestamp(targetUser.id);
            const birthdayText = `🎂 **${username}**'s birthday is **${formattedBirthday}**. That's <t:${nextBirthdayTimestamp}:R>!`;
            return embeds.info(message, birthdayText);
          }
        } catch (error) {
          throw error;
        }
      }
    }
  },

  run: async (client, message, args) => {
    const userService = getService('user');

    if (!args[0]) {
      try {
        const formattedBirthday = await userService.getFormattedBirthday(message.author.id);

        if (!formattedBirthday) {
          return embeds.info(message, `🎂 No birthday set. Use \`,bday set [day] [month]\` to set it`);
        }

        const isBirthdayToday = await userService.isBirthday(message.author.id);

        if (isBirthdayToday) {
          const birthdayText = `🎂 Your birthday is today! Happy birthday!`;
          return embeds.info(message, birthdayText);
        } else {
          const nextBirthdayTimestamp = await getNextBirthdayTimestamp(message.author.id);
          const birthdayText = `🎂 Your birthday is **${formattedBirthday}**. That's <t:${nextBirthdayTimestamp}:R>!`;
          return embeds.info(message, birthdayText);
        }
      } catch (error) {
        throw error;
      }
    }

    const sub = args[0].toLowerCase();

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), userService);
    }

    return module.exports.subcommands.view.handler(client, message, args, userService);
  }
}

// Helper function to calculate next birthday timestamp
async function getNextBirthdayTimestamp(userId) {
  const { getService } = require('@services');
  const userService = getService('user');
  const birthday = await userService.getBirthday(userId);

  if (!birthday) return null;

  const now = new Date();
  const currentYear = now.getFullYear();

  // Create birthday date for this year
  let nextBirthday = new Date(currentYear, birthday.month - 1, birthday.day);

  // If birthday already passed this year, use next year
  if (nextBirthday <= now) {
    nextBirthday = new Date(currentYear + 1, birthday.month - 1, birthday.day);
  }

  // Return Unix timestamp (seconds)
  return Math.floor(nextBirthday.getTime() / 1000);
}

// Add slash command data
module.exports.data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Manage your birthday')
  .setIntegrationTypes([
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  ])
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View a user\'s birthday')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to view')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set your birthday (can only be set once)')
      .addIntegerOption(option =>
        option
          .setName('day')
          .setDescription('Day of birth (1-31)')
          .setMinValue(1)
          .setMaxValue(31)
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('month')
          .setDescription('Month of birth (e.g., January, March or 1, 3)')
          .setRequired(true)
      )
  );

// Add slash command execute
module.exports.execute = async function(interaction) {
  const userService = getService('user');

  try {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const isOwnBirthday = targetUser.id === interaction.user.id;
      const formattedBirthday = await userService.getFormattedBirthday(targetUser.id);

      if (!formattedBirthday) {
        if (isOwnBirthday) {
          return embeds.info(interaction, `🎂 No birthday set. Use \`,bday set [day] [month]\` to set it`, false);
        } else {
          return embeds.info(interaction, `🎂 **${targetUser.username}** has no birthday set`, false);
        }
      }

      const isBirthdayToday = await userService.isBirthday(targetUser.id);

      if (isBirthdayToday) {
        if (isOwnBirthday) {
          return embeds.info(interaction, `🎂 Your birthday is today! Happy birthday!`, false);
        } else {
          return embeds.info(interaction, `🎂 **${targetUser.username}**'s birthday is **${formattedBirthday}** (Today!)`, false);
        }
      } else {
        const nextBirthdayTimestamp = await getNextBirthdayTimestamp(targetUser.id);
        if (isOwnBirthday) {
          return embeds.info(interaction, `🎂 Your birthday is **${formattedBirthday}**. That's <t:${nextBirthdayTimestamp}:R>!`, false);
        } else {
          return embeds.info(interaction, `🎂 **${targetUser.username}**'s birthday is **${formattedBirthday}**. That's <t:${nextBirthdayTimestamp}:R>!`, false);
        }
      }
    } else if (subcommand === 'set') {
      const day = interaction.options.getInteger('day');
      const monthInput = interaction.options.getString('month').toLowerCase();

      // Parse month (accept both numbers and names)
      let month;
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      const monthShort = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
      ];

      if (!isNaN(monthInput)) {
        month = parseInt(monthInput);
        if (month < 1 || month > 12) {
          return embeds.warn(interaction, 'Month must be a number between **1** and **12**', false);
        }
      } else {
        const monthIndex = monthNames.indexOf(monthInput) !== -1 ?
          monthNames.indexOf(monthInput) :
          monthShort.indexOf(monthInput);

        if (monthIndex === -1) {
          return embeds.warn(interaction, 'Invalid month. Use month name (e.g., March) or number (1-12)', false);
        }
        month = monthIndex + 1;
      }

      // Validate day for specific month (basic validation)
      if ((month === 2 && day > 29) ||
        ([4, 6, 9, 11].includes(month) && day > 30)) {
        return embeds.warn(interaction, 'Invalid day for the specified month', false);
      }

      // Ensure user data exists
      await ensureUserData(interaction.user.id);

      try {
        // Check if user already has a birthday set
        const existingBirthday = await userService.getBirthday(interaction.user.id);

        if (existingBirthday && existingBirthday.day && existingBirthday.month) {
          const formattedBirthday = await userService.getFormattedBirthday(interaction.user.id);
          return embeds.warn(interaction, `You already have a birthday set to **${formattedBirthday}**. Birthdays cannot be changed once set.`, false);
        }

        await userService.setBirthday(interaction.user.id, day, month);
        const formattedBirthday = await userService.getFormattedBirthday(interaction.user.id);
        return embeds.success(interaction, `Set your birthday to **${formattedBirthday}**`, false);
      } catch (error) {
        throw error;
      }
    }
  } catch (error) {
    logger.webhook.error(error, { author: interaction.user, guild: interaction.guild, channel: interaction.channel });
    return embeds.deny(interaction, 'An error occurred while processing your request', false);
  }
};