const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Your config
const CONFIG = {
  sourceServerId: '1021202580933709875',
  targetServerId: '1446233910018314335',
  categoryIds: ['1407219946148331601', '1184756824088518677']
};

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('Starting vault transfer...\n');

  try {
    const sourceGuild = await client.guilds.fetch(CONFIG.sourceServerId);
    const targetGuild = await client.guilds.fetch(CONFIG.targetServerId);

    console.log(`Source: ${sourceGuild.name}`);
    console.log(`Target: ${targetGuild.name}\n`);

    for (const categoryId of CONFIG.categoryIds) {
      const sourceCategory = sourceGuild.channels.cache.get(categoryId);
      if (!sourceCategory || sourceCategory.type !== ChannelType.GuildCategory) {
        console.log(`❌ Category ${categoryId} not found, skipping...`);
        continue;
      }

      console.log(`\n📁 Processing category: ${sourceCategory.name}`);

      // Create category in target
      const targetCategory = await targetGuild.channels.create({
        name: sourceCategory.name,
        type: ChannelType.GuildCategory,
        reason: 'Vault transfer'
      });
      console.log(`✅ Created category: ${targetCategory.name}`);

      // Get all text channels in this category
      const channels = sourceGuild.channels.cache.filter(
        ch => ch.parentId === categoryId && ch.type === ChannelType.GuildText
      );

      for (const [, sourceChannel] of channels) {
        console.log(`\n  → Processing #${sourceChannel.name}`);

        // Create channel in target
        const targetChannel = await targetGuild.channels.create({
          name: sourceChannel.name,
          type: ChannelType.GuildText,
          parent: targetCategory.id,
          topic: sourceChannel.topic || null,
          nsfw: sourceChannel.nsfw,
          reason: 'Vault transfer'
        });

        // Fetch ALL messages
        let allMessages = [];
        let lastId = null;

        while (true) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const fetched = await sourceChannel.messages.fetch(options);
          if (fetched.size === 0) break;

          allMessages.push(...fetched.values());
          lastId = fetched.last().id;
          console.log(`    Fetched ${allMessages.length} messages...`);
        }

        // Reverse to send oldest first
        allMessages.reverse();
        console.log(`    Forwarding ${allMessages.length} messages...`);

        let forwarded = 0;
        for (const msg of allMessages) {
          try {
            await msg.forward(targetChannel);
            forwarded++;
          } catch {
            // Fallback: recreate as embed
            try {
              const embed = new EmbedBuilder()
                .setAuthor({ name: msg.author?.tag || 'Unknown', iconURL: msg.author?.displayAvatarURL() })
                .setDescription(msg.content || null)
                .setTimestamp(msg.createdAt);

              if (msg.attachments.size > 0) {
                const att = msg.attachments.first();
                if (att.contentType?.startsWith('image/')) embed.setImage(att.url);
              }

              await targetChannel.send({ embeds: [embed] });
              forwarded++;
            } catch {}
          }

          // Rate limit
          await new Promise(r => setTimeout(r, 1000));

          if (forwarded % 50 === 0) console.log(`    Progress: ${forwarded}/${allMessages.length}`);
        }

        console.log(`  ✅ #${sourceChannel.name}: ${forwarded} messages forwarded`);
      }
    }

    console.log('\n\n🎉 VAULT TRANSFER COMPLETE!');
    process.exit(0);

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
});

client.login(process.env.TOKEN);
