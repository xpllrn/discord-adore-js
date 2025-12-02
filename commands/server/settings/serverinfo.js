const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors } = require('../../../config/setup');

module.exports = {
  name: 'serverinfo',
  aliases: ['si', 'guildinfo', 'server'],
  description: 'Display detailed information about the server',
  syntax: 'serverinfo',
  example: 'serverinfo',
  run: async (client, message, args) => {
    const guild = message.guild;

    // Fetch guild owner
    const owner = await guild.fetchOwner();

    // Calculate server age
    const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

    // Member counts
    const totalMembers = guild.memberCount;
    const humans = guild.members.cache.filter(m => !m.user.bot).size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;

    // Role and emoji counts
    const roleCount = guild.roles.cache.size;
    const emojiCount = guild.emojis.cache.size;

    // Boost information
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;
    const boosterCount = guild.members.cache.filter(m => m.premiumSince).size;

    // Verification level mapping
    const verificationLevels = {
      0: 'None',
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Very High'
    };
    const verificationLevel = verificationLevels[guild.verificationLevel] || 'Unknown';

    // Build embed description
    let description = `Created <t:${createdTimestamp}:R>\n`;
    description += `───────────\n`;
    description += `**${guild.name}** by **${owner.user.tag}**\n`;
    
    if (guild.description) {
      description += `> ${guild.description}\n`;
    }
    
    description += `───────────`;

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ dynamic: true })
      })
      .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
      .setDescription(description)
      .addFields(
        {
          name: '**Members**',
          value: `Total: ${totalMembers}\nHumans: ${humans}\nBots: ${bots}`,
          inline: true
        },
        {
          name: '**Counts**',
          value: `Roles: ${roleCount}/250\nEmojis: ${emojiCount}/100`,
          inline: true
        },
        {
          name: '**Information**',
          value: `Verification: ${verificationLevel}\nBoosts: ${boostCount} (level ${boostLevel})\nBoosters: ${boosterCount}`,
          inline: true
        }
      )
      .setFooter({
        text: `-# ServerID: ${guild.id}   OwnerID: ${owner.id}`
      })
      .setTimestamp();

    // Create buttons for icon, splash, and banner
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Icon')
          .setStyle(ButtonStyle.Link)
          .setURL(guild.iconURL({ size: 1024 }) || 'https://discord.com')
          .setDisabled(!guild.icon),
        new ButtonBuilder()
          .setLabel('Splash')
          .setStyle(ButtonStyle.Link)
          .setURL(guild.splashURL({ size: 1024 }) || 'https://discord.com')
          .setDisabled(!guild.splash),
        new ButtonBuilder()
          .setLabel('Banner')
          .setStyle(ButtonStyle.Link)
          .setURL(guild.bannerURL({ size: 1024 }) || 'https://discord.com')
          .setDisabled(!guild.banner)
      );

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
};
