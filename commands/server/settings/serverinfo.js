const { 
  Container, 
  ContainerSection, 
  TextDisplay, 
  Separator, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

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

    // Create container with Components V2
    const container = new Container();

    // Header section with server creation date
    const headerSection = new ContainerSection()
      .addTextDisplay(new TextDisplay(`Created <t:${createdTimestamp}:R>`));
    container.addSection(headerSection);

    // Separator
    container.addSeparator(new Separator());

    // Server name and owner section
    let serverInfoText = `**${guild.name}** by **${owner.user.tag}**`;
    if (guild.description) {
      serverInfoText += `\n> ${guild.description}`;
    }
    const serverInfoSection = new ContainerSection()
      .addTextDisplay(new TextDisplay(serverInfoText));
    container.addSection(serverInfoSection);

    // Separator
    container.addSeparator(new Separator());

    // Stats section with 3 inline fields
    const statsSection = new ContainerSection()
      .addTextDisplay(new TextDisplay(
        `**Members**\nTotal: ${totalMembers}\nHumans: ${humans}\nBots: ${bots}`
      ))
      .addTextDisplay(new TextDisplay(
        `**Counts**\nRoles: ${roleCount}/250\nEmojis: ${emojiCount}/100`
      ))
      .addTextDisplay(new TextDisplay(
        `**Information**\nVerification: ${verificationLevel}\nBoosts: ${boostCount} (level ${boostLevel})\nBoosters: ${boosterCount}`
      ));
    container.addSection(statsSection);

    // Separator
    container.addSeparator(new Separator());

    // Buttons section for Icon, Splash, Banner
    const iconButton = new ButtonBuilder()
      .setLabel('Icon')
      .setStyle(ButtonStyle.Link)
      .setURL(guild.iconURL({ size: 1024 }) || 'https://discord.com')
      .setDisabled(!guild.icon);

    const splashButton = new ButtonBuilder()
      .setLabel('Splash')
      .setStyle(ButtonStyle.Link)
      .setURL(guild.splashURL({ size: 1024 }) || 'https://discord.com')
      .setDisabled(!guild.splash);

    const bannerButton = new ButtonBuilder()
      .setLabel('Banner')
      .setStyle(ButtonStyle.Link)
      .setURL(guild.bannerURL({ size: 1024 }) || 'https://discord.com')
      .setDisabled(!guild.banner);

    const buttonsSection = new ContainerSection()
      .addTextDisplay(new TextDisplay(''))
      .setAccessory(iconButton);
    
    container.addSection(buttonsSection);

    // Add splash and banner buttons as separate sections
    const splashSection = new ContainerSection()
      .addTextDisplay(new TextDisplay(''))
      .setAccessory(splashButton);
    container.addSection(splashSection);

    const bannerSection = new ContainerSection()
      .addTextDisplay(new TextDisplay(''))
      .setAccessory(bannerButton);
    container.addSection(bannerSection);

    // Separator
    container.addSeparator(new Separator());

    // Footer section with IDs
    const footerSection = new ContainerSection()
      .addTextDisplay(new TextDisplay(`-# ServerID: ${guild.id}   OwnerID: ${owner.id}`));
    container.addSection(footerSection);

    return message.channel.send({
      components: [container]
    });
  }
};
