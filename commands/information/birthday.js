const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { ensureUserData } = require('../../database');
const { createConfirmation, createPagination } = require('../../core/buttons');
const { getService } = require('@services');
const config = require('../../config/setup');

module.exports = {
  name: "bday",
  aliases: ['birthday'],
  description: `manage birthday settings`,
  isGroupCommand: true,
  run: async (client, message, args) => {
    const userService = getService('user');

    if (args[0] === 'set') {
      const subcommandInfo = {
        description: 'Set your birthday',
        usage: '{guildprefix}bday set [day] [month]',
        aliases: [],
        parameters: ['day', 'month'],
        example: '{guildprefix}bday set 2 March'
      };

      // Set birthday (universal)
      if (!args[1] || !args[2]) {
        return runHelpCommand(message, 'bday');
      }

      const day = parseInt(args[1]);
      const monthInput = args[2].toLowerCase();

      // Validate day
      if (isNaN(day) || day < 1 || day > 31) {
        return embeds.warn(message, 'Day must be a number between **1** and **31**');
      }

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

      // Validate day for specific month (basic validation)
      if ((month === 2 && day > 29) ||
        ([4, 6, 9, 11].includes(month) && day > 30)) {
        return embeds.warn(message, 'Invalid day for the specified month');
      }

      // Ensure user data exists
      await ensureUserData(message.author.id);

      try {
        // Check if user already has a birthday set using service layer
        const existingBirthday = await userService.getBirthday(message.author.id);

        if (existingBirthday && existingBirthday.day && existingBirthday.month) {
          const formattedBirthday = await userService.getFormattedBirthday(message.author.id);
          return embeds.warn(message, `You already have a birthday set to **${formattedBirthday}**. Birthdays cannot be changed once set.`);
        }

        await userService.setBirthday(message.author.id, day, month);
        const formattedBirthday = await userService.getFormattedBirthday(message.author.id);
        return embeds.success(message, `Set your birthday to **${formattedBirthday}**`);
      } catch (error) {
        console.error('Error setting birthday:', error);
        return embeds.deny(message, 'Failed to set birthday');
      }

    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Reset a user birthday (dev only)',
        usage: '{guildprefix}bday reset [user]',
        aliases: [],
        parameters: ['user'],
        example: '{guildprefix}bday reset @user'
      };

      // Reset user's birthday (dev only)
      if (!await hasPermissionLevel(message, 'dev')) return;

      if (!args[1]) {
        return runHelpCommand(message, 'bday');
      }

      // Find the target user
      const userResult = await findUser(message.guild, args.slice(1).join(' '), client);

      if (!userResult.found) {
        return embeds.warn(message, userResult.error || 'User not found');
      }

      let targetUser, targetMember;
      if (userResult.isGlobal) {
        targetUser = userResult.user;
        targetMember = null;
      } else {
        targetUser = userResult.user.user || userResult.user;
        targetMember = userResult.user;
      }

      // Ensure user data exists
      await ensureUserData(targetUser.id);

      try {
        // Get current birthday using service layer
        const currentBirthday = await userService.getBirthday(targetUser.id);

        if (!currentBirthday || !currentBirthday.day || !currentBirthday.month) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.warn(message, `**${username}** has no birthday set`);
        }

        const username = targetMember ? targetMember.displayName : targetUser.username;

        // Show confirmation dialog
        await createConfirmation(
          message,
          `Are you sure you want to **reset the birthday** for **${username}**?`,
          async (interaction) => {
            // On approve: clear birthday
            await userService.clearBirthday(targetUser.id);

            // Edit the confirmation embed to show success message
            const successEmbed = embeds.createSuccess(message, `Reset birthday for **${username}**`);

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      } catch (error) {
        console.error('Error resetting birthday:', error);
        return embeds.deny(message, 'Failed to reset birthday');
      }

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all birthdays in the server',
        usage: '{guildprefix}bday list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}bday list'
      };

      // List all birthdays in the server
      try {
        const guildMembers = await message.guild.members.fetch();
        const birthdayData = [];

        // Get birthday data for all guild members
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
            // Skip users with birthday fetch errors
            continue;
          }
        }

        if (birthdayData.length === 0) {
          return embeds.warn(message, 'No birthdays found in this server');
        }

        // Sort by month and day (upcoming birthdays first)
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        const currentSortKey = `${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;

        birthdayData.sort((a, b) => {
          // Put today's birthdays first
          if (a.isBirthdayToday && !b.isBirthdayToday) return -1;
          if (!a.isBirthdayToday && b.isBirthdayToday) return 1;
          if (a.isBirthdayToday && b.isBirthdayToday) return 0;

          // Then sort by upcoming birthdays
          const aIsUpcoming = a.sortKey >= currentSortKey;
          const bIsUpcoming = b.sortKey >= currentSortKey;

          if (aIsUpcoming && !bIsUpcoming) return -1;
          if (!aIsUpcoming && bIsUpcoming) return 1;

          // Within the same category, sort by date
          return a.sortKey.localeCompare(b.sortKey);
        });

        // Format page function for pagination
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

        // Use pagination system with 10 items per page
        await createPagination(message, birthdayData, formatPage, 10, 'Server Birthdays');

      } catch (error) {
        console.error('Error listing birthdays:', error);
        return embeds.deny(message, 'Failed to list birthdays');
      }

    } else if (args[0]) {
      // Show specific user's birthday
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.warn(message, userResult.error || 'User not found');
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
        console.error('Error getting birthday:', error);
        return embeds.deny(message, 'Failed to get birthday');
      }

    } else {
      // Show user's own birthday
      try {
        const formattedBirthday = await userService.getFormattedBirthday(message.author.id);

        if (!formattedBirthday) {
          return embeds.info(message, `🎂 No birthday set. Use \`,bday set [day] [month]\` to set it`);
        }

        const isBirthdayToday = await userService.isBirthday(message.author.id);

        if (isBirthdayToday) {
          const birthdayText = `🎂 Your birthday is **${formattedBirthday}** (Today!)`;
          return embeds.info(message, birthdayText);
        } else {
          const nextBirthdayTimestamp = await getNextBirthdayTimestamp(message.author.id);
          const birthdayText = `🎂 Your birthday is **${formattedBirthday}**. That's <t:${nextBirthdayTimestamp}:R>!`;
          return embeds.info(message, birthdayText);
        }
      } catch (error) {
        console.error('Error getting birthday:', error);
        return embeds.deny(message, 'Failed to get birthday');
      }
    }
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