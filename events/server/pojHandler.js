// Poj (Ping on Join) handler - sends auto-deleting messages when members join

const { EmbedVariableProcessor } = require('../../utils/embedbuilder');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      if (!member.guild) return;

      const guildCache = require('../../database/cache/models/guild');
      
      // Get poj messages for this guild
      const pojMessages = await guildCache.getPojMessages(member.guild.id);
      
      if (!pojMessages || pojMessages.length === 0) {
        return; // No poj messages configured
      }

      // Process each poj message
      for (const poj of pojMessages) {
        try {
          const channel = member.guild.channels.cache.get(poj.channelId);
          
          if (!channel) {
            // Channel doesn't exist anymore, remove it
            await guildCache.removePojMessage(member.guild.id, poj.channelId);
            continue;
          }

          // Check if bot has permission to send messages
          if (!channel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'ViewChannel'])) {
            continue; // Skip if no permissions
          }

          // Process the message with variables
          try {
            const processedMessage = await EmbedVariableProcessor.process(channel, poj.message, {
              user: member.user,
              member: member,
              guild: member.guild,
              channel: channel,
              source: 'poj'
            });

            // If processing returned a message object, send it and delete after 1 second
            if (processedMessage) {
              setTimeout(async () => {
                try {
                  await processedMessage.delete();
                } catch (deleteError) {
                  // Silent fail if message was already deleted or bot lacks permissions
                }
              }, 1000); // 1 second delay
            }
          } catch (processError) {
            // If EmbedVariableProcessor fails, send the raw message
            try {
              const sentMessage = await channel.send(poj.message);
              
              // Delete after 1 second
              setTimeout(async () => {
                try {
                  await sentMessage.delete();
                } catch (deleteError) {
                  // Silent fail if message was already deleted or bot lacks permissions
                }
              }, 1000); // 1 second delay
            } catch (sendError) {
              // Silent fail if can't send message
            }
          }

        } catch (pojError) {
          // Silent fail for individual poj message processing
          console.error(`Error processing poj message for ${member.guild.id}-${poj.channelId}:`, pojError);
        }
      }

    } catch (error) {
      // Silent fail for poj system
      console.error('Error in poj handler:', error);
    }
  }
}
