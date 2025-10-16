const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('../../config/setup');
const { colors, emojis } = config;

module.exports = {
  name: 'guildDelete',
  async execute(guild, client) {
    logGuildLeave(guild, client);
  },
};

async function logGuildLeave(guild, client) {
  try {
    const webhook = new WebhookClient({ url: config.logging.guildWebhookUrl });
    
    // Get owner info
    let ownerInfo = 'Unknown';
    try {
      const owner = await client.users.fetch(guild.ownerId);
      ownerInfo = `${owner.username} (\`${owner.id}\`)`;
    } catch (error) {
      ownerInfo = `Unknown (\`${guild.ownerId}\`)`;
    }

    // Calculate member counts
    const totalMembers = guild.memberCount || 0;
    const botCount = guild.members.cache.filter(member => member.user.bot).size || 0;
    const humanCount = totalMembers - botCount;

    // Get boost info
    const boostCount = guild.premiumSubscriptionCount || 0;
    const boostLevel = guild.premiumTier || 0;
    
    // Get channel count
    const channelCount = guild.channels.cache.size || 0;

    const embed = new EmbedBuilder()
      .setColor(colors.error)
      .setDescription(`${emojis.leave} adore **unlinked** with **${guild.name}**\n\n> created on : <t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n> created by : ${ownerInfo}`)
      .setAuthor({ 
        name: `${guild.name} (${guild.id})`, 
        iconURL: guild.iconURL({ dynamic: true }) 
      })
      .setFooter({ text: `Linked Guilds : ${client.guilds.cache.size}` })
      .addFields(
        { 
          name: 'member count', 
          value: `> **humans**: ${humanCount}\n> **bots**: ${botCount}`, 
          inline: true 
        },
        { 
          name: 'information', 
          value: `> **boost**: ${boostCount} (level ${boostLevel})\n> **channels**: ${channelCount}`, 
          inline: true 
        }
      )

    await webhook.send({ embeds: [embed] });
  } catch (error) {
    // Silent fail
  }
}
