const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const config = require('./config/setup');

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

// Media file extensions to transfer
const MEDIA_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', // images
  '.mp4', '.webm', '.mov', '.avi', '.mkv',          // videos
  '.mp3', '.wav', '.ogg', '.flac'                   // audio (optional)
];

function isMediaAttachment(attachment) {
  const name = attachment.name?.toLowerCase() || '';
  const contentType = attachment.contentType?.toLowerCase() || '';
  
  // Check by content type
  if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
    return true;
  }
  
  // Check by extension
  return MEDIA_EXTENSIONS.some(ext => name.endsWith(ext));
}

function hasMedia(message) {
  // ONLY check direct attachments - skip embeds, links, etc.
  if (message.attachments.size === 0) return false;
  
  for (const [, att] of message.attachments) {
    if (isMediaAttachment(att)) return true;
  }
  
  return false;
}

client.once('ready', async () => {
  console.log('═'.repeat(50));
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log('═'.repeat(50));
  console.log('\n🚀 Starting vault transfer (MEDIA ONLY)...\n');

  const startTime = Date.now();
  let totalChannels = 0;
  let totalMediaForwarded = 0;
  let totalSkipped = 0;

  try {
    console.log(`📡 Fetching source server: ${CONFIG.sourceServerId}`);
    const sourceGuild = await client.guilds.fetch(CONFIG.sourceServerId);
    await sourceGuild.channels.fetch(); // Fetch all channels
    
    console.log(`📡 Fetching target server: ${CONFIG.targetServerId}`);
    const targetGuild = await client.guilds.fetch(CONFIG.targetServerId);

    console.log('\n' + '─'.repeat(50));
    console.log(`📦 Source: ${sourceGuild.name} (${sourceGuild.id})`);
    console.log(`📦 Target: ${targetGuild.name} (${targetGuild.id})`);
    console.log(`📂 Categories to transfer: ${CONFIG.categoryIds.length}`);
    console.log('─'.repeat(50) + '\n');

    for (const categoryId of CONFIG.categoryIds) {
      const sourceCategory = sourceGuild.channels.cache.get(categoryId);
      if (!sourceCategory || sourceCategory.type !== ChannelType.GuildCategory) {
        console.log(`\n❌ Category ${categoryId} not found, skipping...`);
        continue;
      }

      console.log('\n' + '═'.repeat(50));
      console.log(`📁 CATEGORY: ${sourceCategory.name}`);
      console.log('═'.repeat(50));

      // Create category in target
      const targetCategory = await targetGuild.channels.create({
        name: sourceCategory.name,
        type: ChannelType.GuildCategory,
        reason: 'Vault transfer'
      });
      console.log(`✅ Created category in target: ${targetCategory.name}`);

      // Get all text channels in this category
      const channels = sourceGuild.channels.cache.filter(
        ch => ch.parentId === categoryId && ch.type === ChannelType.GuildText
      );

      console.log(`📋 Found ${channels.size} channels in this category\n`);

      for (const [, sourceChannel] of channels) {
        totalChannels++;
        console.log('\n' + '─'.repeat(40));
        console.log(`📺 Channel ${totalChannels}: #${sourceChannel.name}`);
        console.log('─'.repeat(40));

        // Create channel in target
        const targetChannel = await targetGuild.channels.create({
          name: sourceChannel.name,
          type: ChannelType.GuildText,
          parent: targetCategory.id,
          topic: sourceChannel.topic || null,
          nsfw: sourceChannel.nsfw,
          reason: 'Vault transfer'
        });
        console.log(`   ✅ Created target channel: #${targetChannel.name}`);

        // Fetch ALL messages
        let allMessages = [];
        let lastId = null;
        let fetchCount = 0;

        console.log(`   📥 Fetching messages...`);
        while (true) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const fetched = await sourceChannel.messages.fetch(options);
          if (fetched.size === 0) break;

          allMessages.push(...fetched.values());
          lastId = fetched.last().id;
          fetchCount++;
          
          if (fetchCount % 5 === 0) {
            console.log(`      ... fetched ${allMessages.length} messages so far`);
          }
        }

        console.log(`   📊 Total messages found: ${allMessages.length}`);

        // Filter to only media messages
        const mediaMessages = allMessages.filter(hasMedia);
        const skippedCount = allMessages.length - mediaMessages.length;
        totalSkipped += skippedCount;

        console.log(`   🖼️  Messages with media: ${mediaMessages.length}`);
        console.log(`   ⏭️  Skipping (no media): ${skippedCount}`);

        if (mediaMessages.length === 0) {
          console.log(`   ℹ️  No media to transfer, moving on...`);
          continue;
        }

        // Reverse to send oldest first
        mediaMessages.reverse();
        console.log(`   📤 Forwarding ${mediaMessages.length} media messages...`);

        let forwarded = 0;
        let failed = 0;

        for (const msg of mediaMessages) {
          try {
            await msg.forward(targetChannel);
            forwarded++;
            totalMediaForwarded++;
            
            if (forwarded % 10 === 0) {
              console.log(`      ✓ Progress: ${forwarded}/${mediaMessages.length} (${Math.round(forwarded/mediaMessages.length*100)}%)`);
            }
          } catch (err) {
            // Fallback: just send the attachment URLs directly
            try {
              const urls = msg.attachments
                .filter(att => isMediaAttachment(att))
                .map(att => att.url);
              
              if (urls.length > 0) {
                await targetChannel.send({ content: urls.join('\n') });
                forwarded++;
                totalMediaForwarded++;
                console.log(`      ↪ Fallback sent for msg ${msg.id}`);
              } else {
                failed++;
                console.log(`      ⚠️  Failed msg ${msg.id}: ${err.message}`);
              }
            } catch (fallbackErr) {
              failed++;
              console.log(`      ⚠️  Failed msg ${msg.id}: ${err.message}`);
            }
          }

          // Rate limit - 1 second between forwards
          await new Promise(r => setTimeout(r, 1000));
        }

        console.log(`   ✅ Done: ${forwarded} forwarded, ${failed} failed`);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    console.log('\n\n' + '═'.repeat(50));
    console.log('🎉 VAULT TRANSFER COMPLETE!');
    console.log('═'.repeat(50));
    console.log(`📊 Stats:`);
    console.log(`   • Channels processed: ${totalChannels}`);
    console.log(`   • Media forwarded: ${totalMediaForwarded}`);
    console.log(`   • Messages skipped (no media): ${totalSkipped}`);
    console.log(`   • Time elapsed: ${minutes}m ${seconds}s`);
    console.log('═'.repeat(50) + '\n');
    
    process.exit(0);

  } catch (err) {
    console.error('\n❌ ERROR:', err);
    process.exit(1);
  }
});

client.login(config.bot.token);
