const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { colors } = require('../../config/setup');

module.exports = {
  name: "boosters",
  aliases: ['booster'],
  description: 'View boost tracking information',
  syntax: 'boosters (lost/new)',
  example: 'boosters lost',
  permission: "Manage Guild",
  run: async(client, message, args) => {
    const guildService = getService('guild');

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['lost', 'new'].includes(subcommand)) {
      return embeds.warn(message, 'Usage: `,boosters lost` or `,boosters new`');
    }

    if (subcommand === 'lost') {
      return handleBoostLost(client, message);
    } else if (subcommand === 'new') {
      return handleBoostNew(client, message);
    }
  }
};

// Handle boost lost subcommand
async function handleBoostLost(client, message) {
  try {
    // Get recent boost removals
    const recentBoostRemoves = await guildService.getRecentBoostRemoves(message.guild.id, 20);

    if (recentBoostRemoves.length === 0) {
      return embeds.warn(message, 'No **recently lost boosters** have been recorded yet');
    }

      // Format the list
      const userList = recentBoostRemoves.map((event, index) => {
        const position = index + 1;

        // Format timestamp as unix timestamp for Discord
        const timestamp = new Date(event.timestamp);
        const timeString = `<t:${Math.floor(timestamp.getTime() / 1000)}:R>`;

        // Calculate boost duration if we have the start time
        let durationString = '';
        if (event.boostStartTime) {
          const startTime = new Date(event.boostStartTime);
          const endTime = new Date(event.timestamp);
          const durationMs = endTime.getTime() - startTime.getTime();

          // Convert to weeks/days
          const weeks = Math.floor(durationMs / (7 * 24 * 60 * 60 * 1000));
          const days = Math.floor((durationMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));

          if (weeks > 0) {
            durationString = ` (lasted ${weeks}w${days > 0 ? ` ${days}d` : ''})`;
          } else if (days > 0) {
            durationString = ` (lasted ${days}d)`;
          } else {
            durationString = ' (lasted <1d)';
          }
        }

        // Format: "1 <@userId> stopped timeString durationString"
        return `${position} <@${event.userId}> stopped ${timeString}${durationString}`;
      });

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle('Lost Boosters')
        .setDescription(userList.join('\n'))
        .setFooter({ text: `${recentBoostRemoves.length} boost removal${recentBoostRemoves.length !== 1 ? 's' : ''} tracked` });

      // Create refresh button
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('boosters_lost_refresh')
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
        );

      const sentMessage = await message.channel.send({ 
        embeds: [embed], 
        components: [row] 
      });

      // Create collector for refresh button
      const collector = sentMessage.createMessageComponentCollector({
        time: 60000 // 1 minute timeout
      });

      collector.on('collect', async (interaction) => {
        try {
          if (interaction.customId === 'boosters_lost_refresh') {
            // Check if user has permission to refresh
            if (!interaction.member.permissions.has('ManageGuild')) {
              return interaction.reply({
                content: 'You need **Manage Guild** permission to refresh this list.',
                ephemeral: true
              });
            }

            // Get updated data
            const updatedBoostRemoves = await guildService.getRecentBoostRemoves(message.guild.id, 20);

            if (updatedBoostRemoves.length === 0) {
              const noDataEmbed = new EmbedBuilder()
                .setColor(colors.embed)
                .setTitle('Lost Boosters')
                .setDescription('No boost removals have been tracked yet')
                .setFooter({ text: '0 boost removals tracked' });

              return interaction.update({ embeds: [noDataEmbed] });
            }

            // Format updated list
            const updatedUserList = updatedBoostRemoves.map((event, index) => {
              const position = index + 1;

              // Format timestamp as unix timestamp for Discord
              const timestamp = new Date(event.timestamp);
              const timeString = `<t:${Math.floor(timestamp.getTime() / 1000)}:R>`;

              // Calculate boost duration if we have the start time
              let durationString = '';
              if (event.boostStartTime) {
                const startTime = new Date(event.boostStartTime);
                const endTime = new Date(event.timestamp);
                const durationMs = endTime.getTime() - startTime.getTime();

                // Convert to weeks/days
                const weeks = Math.floor(durationMs / (7 * 24 * 60 * 60 * 1000));
                const days = Math.floor((durationMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));

                if (weeks > 0) {
                  durationString = ` (lasted ${weeks}w${days > 0 ? ` ${days}d` : ''})`;
                } else if (days > 0) {
                  durationString = ` (lasted ${days}d)`;
                } else {
                  durationString = ' (lasted <1d)';
                }
              }

              // Format: "1 <@userId> stopped timeString durationString"
              return `${position} <@${event.userId}> stopped ${timeString}${durationString}`;
            });

            const updatedEmbed = new EmbedBuilder()
              .setColor(colors.embed)
              .setTitle('Lost Boosters')
              .setDescription(updatedUserList.join('\n'))
              .setFooter({ text: `${updatedBoostRemoves.length} boost removal${updatedBoostRemoves.length !== 1 ? 's' : ''} tracked` });

            await interaction.update({ embeds: [updatedEmbed] });
          }
        } catch (error) {
          console.error('Error handling boostlost refresh:', error);
          try {
            await interaction.reply({
              content: 'An error occurred while refreshing the list.',
              ephemeral: true
            });
          } catch (replyError) {
            // Ignore if we can't reply
          }
        }
      });

      collector.on('end', async () => {
        try {
          // Disable the button after timeout
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('boosters_lost_refresh')
                .setLabel('Refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );

          await sentMessage.edit({ components: [disabledRow] });
        } catch (error) {
          // Message might have been deleted
        }
      });

    } catch (error) {
      console.error('Error in boosters lost command:', error);
      return embeds.deny(message, 'An error occurred while fetching boost removal data');
    }
}

// Handle boost new subcommand
async function handleBoostNew(client, message) {
  try {
    // Get recent boost additions
    const recentBoostAdds = await guildService.getRecentBoostAdds(message.guild.id, 20);

    if (recentBoostAdds.length === 0) {
      return embeds.warn(message, 'No **recently new boosters** have been recorded yet');
    }

    // Format the list
    const userList = recentBoostAdds.map((event, index) => {
      const position = index + 1;

      // Format timestamp as unix timestamp for Discord
      const timestamp = new Date(event.timestamp);
      const timeString = `<t:${Math.floor(timestamp.getTime() / 1000)}:R>`;

      // Format: "1 <@userId> started timeString"
      return `${position} <@${event.userId}> started ${timeString}`;
    });

    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle('New Boosters')
      .setDescription(userList.join('\n'))
      .setFooter({ text: `${recentBoostAdds.length} boost addition${recentBoostAdds.length !== 1 ? 's' : ''} tracked` });

    // Create refresh button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('boosters_new_refresh')
          .setLabel('Refresh')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary)
      );

    const sentMessage = await message.channel.send({
      embeds: [embed],
      components: [row]
    });

    // Create collector for refresh button
    const collector = sentMessage.createMessageComponentCollector({
      time: 60000 // 1 minute timeout
    });

    collector.on('collect', async (interaction) => {
      try {
        if (interaction.customId === 'boosters_new_refresh') {
          // Check if user has permission to refresh
          if (!interaction.member.permissions.has('ManageGuild')) {
            return interaction.reply({
              content: 'You need **Manage Guild** permission to refresh this list.',
              ephemeral: true
            });
          }

          // Get updated data
          const updatedBoostAdds = await guildService.getRecentBoostAdds(message.guild.id, 20);

          if (updatedBoostAdds.length === 0) {
            const noDataEmbed = new EmbedBuilder()
              .setColor(colors.embed)
              .setTitle('New Boosters')
              .setDescription('No boost additions have been tracked yet')
              .setFooter({ text: '0 boost additions tracked' });

            return interaction.update({ embeds: [noDataEmbed] });
          }

          // Format updated list
          const updatedUserList = updatedBoostAdds.map((event, index) => {
            const position = index + 1;

            // Format timestamp as unix timestamp for Discord
            const timestamp = new Date(event.timestamp);
            const timeString = `<t:${Math.floor(timestamp.getTime() / 1000)}:R>`;

            // Format: "1 <@userId> started timeString"
            return `${position} <@${event.userId}> started ${timeString}`;
          });

          const updatedEmbed = new EmbedBuilder()
            .setColor(colors.embed)
            .setTitle('New Boosters')
            .setDescription(updatedUserList.join('\n'))
            .setFooter({ text: `${updatedBoostAdds.length} boost addition${updatedBoostAdds.length !== 1 ? 's' : ''} tracked` });

          await interaction.update({ embeds: [updatedEmbed] });
        }
      } catch (error) {
        console.error('Error handling boosters new refresh:', error);
        try {
          await interaction.reply({
            content: 'An error occurred while refreshing the list.',
            ephemeral: true
          });
        } catch (replyError) {
          // Ignore if we can't reply
        }
      }
    });

    collector.on('end', async () => {
      try {
        // Disable the button after timeout
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('boosters_new_refresh')
              .setLabel('Refresh')
              .setEmoji('🔄')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

        await sentMessage.edit({ components: [disabledRow] });
      } catch (error) {
        // Message might have been deleted
      }
    });

  } catch (error) {
    console.error('Error in boosters new command:', error);
    return embeds.deny(message, 'An error occurred while fetching boost addition data');
  }
}
