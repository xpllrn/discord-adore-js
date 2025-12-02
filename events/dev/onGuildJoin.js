const { WebhookClient, EmbedBuilder } = require('discord.js');
const { ensureGuildData } = require('../../database');
const config = require('../../config/setup');
const { colors, emojis } = config;

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    // Skip guild events during bot startup (cache loading)
    if (!client.cacheReady) {
      return;
    }
    
    // Check if server is blacklisted
    const isBlacklisted = await checkServerBlacklist(guild.id);
    if (isBlacklisted) {
      try {
        await guild.leave();
        logBlacklistedGuild(guild, client);
      } catch (error) {
        // Silent fail
      }
      return;
    }

    createGuildData(guild);
    logGuildJoin(guild, client);
  },
};

async function checkServerBlacklist(serverId) {
  const { getService } = require('@services');
  const systemService = getService('system');
  return await systemService.getServerBlacklist(serverId);
}

async function createGuildData(guild) {
  try {
    await ensureGuildData(guild.id);
  } catch (error) {
    // Silent fail
  }
}

async function logGuildJoin(guild, client) {
  try {
    if (!config.logging.guildWebhookUrl) {
      console.log(`[GUILD JOIN] ${guild.name} (${guild.id}) - Guild webhook logging disabled`);
      return;
    }

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
      .setColor(colors.success)
      .setDescription(`adore successfully **linked** with **${guild.name}**\n\n> **created on** : <t:${Math.floor(guild.createdTimestamp / 1000)}:D>\n> **created by** : ${ownerInfo}`)
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

async function logBlacklistedGuild(guild, client) {
  try {
    if (!config.logging.guildWebhookUrl) {
      console.log(`[BLACKLISTED GUILD] ${guild.name} (${guild.id}) - Guild webhook logging disabled`);
      return;
    }

    const webhook = new WebhookClient({ url: config.logging.guildWebhookUrl });

    // Get owner info
    let ownerInfo = 'Unknown';
    try {
      const owner = await client.users.fetch(guild.ownerId);
      ownerInfo = `${owner.username} (\`${owner.id}\`)`;
    } catch (error) {
      ownerInfo = `Unknown (\`${guild.ownerId}\`)`;
    }

    const embed = new EmbedBuilder()
      .setColor(colors.warn)
      .setDescription(`${emojis.warn} Someone trying to link with **${guild.name}**\n\n> created on : <t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n> created by : ${ownerInfo}`)
      .setAuthor({
        name: `${guild.name} (${guild.id})`,
        iconURL: guild.iconURL({ dynamic: true })
      })
      .setFooter({ text: `Linked Guilds : ${client.guilds.cache.size}` })
      .setTimestamp();

    await webhook.send({ embeds: [embed] });
  } catch (error) {
    // Silent fail
  }
}
