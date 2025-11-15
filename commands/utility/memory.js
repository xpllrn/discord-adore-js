const { EmbedBuilder } = require('discord.js');
const { User } = require('../../database');

module.exports = {
  name: "memory",
  aliases: ['memories', 'history'],
  description: 'View or clear your conversation memory with vleed',
  usage: '{guildprefix}memory [view|clear]',
  example: '{guildprefix}memory view',
  run: async (client, message, args) => {
    const action = args[0]?.toLowerCase() || 'view';

    if (action === 'clear') {
      // Clear user's conversation memory
      await User.findOneAndUpdate(
        { UserID: message.author.id },
        { $set: { ConversationMemory: [] } }
      );

      return message.channel.send('✅ Your conversation memory has been cleared.');
    }

    if (action === 'view') {
      // Get user's conversation memory
      const userData = await User.findOne({ UserID: message.author.id });

      if (!userData || !userData.ConversationMemory || userData.ConversationMemory.length === 0) {
        return message.channel.send('You have no conversation memory yet. Start chatting with vleed using the `ask` command!');
      }

      // Sort by most recent
      const memories = userData.ConversationMemory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setTitle('📝 Your Conversation Memory')
        .setDescription('Here\'s what vleed remembers about your conversations:')
        .setColor('#5865F2')
        .setFooter({ text: `${memories.length} memories stored` });

      memories.forEach((mem, index) => {
        const timeAgo = getTimeAgo(mem.timestamp);
        embed.addFields({
          name: `${index + 1}. ${timeAgo}`,
          value: mem.summary,
          inline: false
        });
      });

      return message.channel.send({ embeds: [embed] });
    }

    return message.channel.send('Usage: `memory [view|clear]`');
  }
};

// Helper function to format time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
