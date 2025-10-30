class Snipe {
  constructor() {
    this.snipes = new Map(); // channelId -> array of snipes
    this.editsnipes = new Map(); // channelId -> array of editsnipes  
    this.reactionsnipes = new Map(); // channelId -> array of reactionsnipes
    this.maxPerChannel = 10;
    this.ttl = 2 * 60 * 60 * 1000; // 2 hours TTL
    
    // Cleanup expired entries every 30 minutes
    setInterval(() => {
      this.cleanupExpired();
    }, 30 * 60 * 1000);
  }

  // Remove expired entries from all caches
  cleanupExpired() {
    const now = Date.now();
    
    this.cleanupCacheMap(this.snipes, now);
    this.cleanupCacheMap(this.editsnipes, now);
    this.cleanupCacheMap(this.reactionsnipes, now);
  }

  // Clean expired entries from a specific cache map
  cleanupCacheMap(cacheMap, now) {
    for (const [channelId, items] of cacheMap.entries()) {
      const validItems = items.filter(item => (now - item.timestamp) < this.ttl);
      
      if (validItems.length === 0) {
        cacheMap.delete(channelId);
      } else if (validItems.length !== items.length) {
        cacheMap.set(channelId, validItems);
      }
    }
  }

  // Get non-expired items from cache
  getValidItems(cacheMap, channelId) {
    const items = cacheMap.get(channelId) || [];
    const now = Date.now();
    
    const validItems = items.filter(item => (now - item.timestamp) < this.ttl);
    
    // Update cache if items were filtered out
    if (validItems.length !== items.length) {
      if (validItems.length === 0) {
        cacheMap.delete(channelId);
      } else {
        cacheMap.set(channelId, validItems);
      }
    }
    
    return validItems;
  }

  // Add deleted message to snipe cache
  addDeletedMessage(message) {
    const channelId = message.channel.id;

    // Get existing snipes for this channel
    const channelSnipes = this.snipes.get(channelId) || [];

    // Process message data
    const snipeData = this.processMessageData(message);

    // Add to beginning of array
    channelSnipes.unshift(snipeData);

    // Keep only last 10 snipes
    if (channelSnipes.length > this.maxPerChannel) {
      channelSnipes.splice(this.maxPerChannel);
    }

    // Update cache
    this.snipes.set(channelId, channelSnipes);
  }

  // Add edited message to editsnipe cache
  addEditedMessage(oldMessage, newMessage) {
    const channelId = oldMessage.channel.id;
    
    // Get existing editsnipes for this channel
    const channelEditSnipes = this.editsnipes.get(channelId) || [];
    
    // Process message data
    const editSnipeData = this.processEditData(oldMessage, newMessage);
    
    // Add to beginning of array
    channelEditSnipes.unshift(editSnipeData);
    
    // Keep only last 10 editsnipes
    if (channelEditSnipes.length > this.maxPerChannel) {
      channelEditSnipes.splice(this.maxPerChannel);
    }
    
    // Update cache
    this.editsnipes.set(channelId, channelEditSnipes);
  }

  // Add removed reaction to reactionsnipe cache
  addRemovedReaction(reaction, user) {
    const channelId = reaction.message.channel.id;
    
    // Get existing reactionsnipes for this channel
    const channelReactionSnipes = this.reactionsnipes.get(channelId) || [];
    
    // Process reaction data
    const reactionSnipeData = this.processReactionData(reaction, user);
    
    // Add to beginning of array
    channelReactionSnipes.unshift(reactionSnipeData);
    
    // Keep only last 10 reactionsnipes
    if (channelReactionSnipes.length > this.maxPerChannel) {
      channelReactionSnipes.splice(this.maxPerChannel);
    }
    
    // Update cache
    this.reactionsnipes.set(channelId, channelReactionSnipes);
  }

  // Get deleted messages for channel (with TTL filtering)
  getDeletedMessages(channelId) {
    return this.getValidItems(this.snipes, channelId);
  }

  // Get edited messages for channel (with TTL filtering)
  getEditedMessages(channelId) {
    return this.getValidItems(this.editsnipes, channelId);
  }

  // Get removed reactions for channel (with TTL filtering)
  getRemovedReactions(channelId) {
    return this.getValidItems(this.reactionsnipes, channelId);
  }

  // Clear all snipe data for a channel
  clearChannel(channelId) {
    this.snipes.delete(channelId);
    this.editsnipes.delete(channelId);
    this.reactionsnipes.delete(channelId);
  }

  // Process message data for snipes
  processMessageData(message) {
    let imageUrl = null;
    let content = message.content;
    let attachmentUrls = [];

    // Handle attachments with permanent links
    if (message.attachments.size > 0) {
      message.attachments.forEach(attachment => {
        let cleanUrl = attachment.url.split('?')[0];
        cleanUrl = cleanUrl.replace('media.discordapp.net', 'cdn.discordapp.com');
        attachmentUrls.push(cleanUrl);
      });
      imageUrl = attachmentUrls[0];
    }

    // Handle stickers
    const sticker = message.stickers.first();
    if (sticker) {
      if (!content || content.trim() === '') {
        content = sticker.name;
      }
    }

    // Handle empty content
    if (!content || content.trim() === '') {
      if (message.attachments.size === 0 && !sticker) {
        content = '*No content*';
      }
    }

    return {
      content,
      author: message.author.tag,
      authorId: message.author.id,
      authorAvatar: message.author.displayAvatarURL({ format: "png", dynamic: true }),
      image: imageUrl,
      attachments: attachmentUrls,
      timestamp: Date.now(), // Use deletion time for proper chronological order
      messageId: message.id,
      replyToMessageId: message.reference?.messageId || null // Store reply reference
    };
  }

  // Process edit data for editsnipes
  processEditData(oldMessage, newMessage) {
    let imageUrl = null;
    let oldContent = oldMessage.content;
    let newContent = newMessage.content;
    let attachmentUrls = [];

    // Handle attachments with permanent links
    if (newMessage.attachments.size > 0) {
      newMessage.attachments.forEach(attachment => {
        let cleanUrl = attachment.url.split('?')[0];
        cleanUrl = cleanUrl.replace('media.discordapp.net', 'cdn.discordapp.com');
        attachmentUrls.push(cleanUrl);
      });
      imageUrl = attachmentUrls[0];
    }

    // Handle stickers
    const oldSticker = oldMessage.stickers.first();
    const newSticker = newMessage.stickers.first();

    if (oldSticker && (!oldContent || oldContent.trim() === '')) {
      oldContent = oldSticker.name;
    }

    if (newSticker && (!newContent || newContent.trim() === '')) {
      newContent = newSticker.name;
    }

    // Handle empty content
    if (!oldContent || oldContent.trim() === '') {
      if (oldMessage.attachments.size === 0 && !oldSticker) {
        oldContent = '*No content*';
      }
    }

    if (!newContent || newContent.trim() === '') {
      if (newMessage.attachments.size === 0 && !newSticker) {
        newContent = '*No content*';
      }
    }

    return {
      oldContent,
      newContent,
      author: newMessage.author.tag,
      authorId: newMessage.author.id,
      authorAvatar: newMessage.author.displayAvatarURL({ format: "png", dynamic: true }),
      image: imageUrl,
      attachments: attachmentUrls,
      timestamp: newMessage.editedTimestamp || newMessage.createdTimestamp, // Use edit time or creation time
      messageId: newMessage.id
    };
  }

  // Process reaction data for reactionsnipes
  processReactionData(reaction, user) {
    return {
      emoji: reaction.emoji.name,
      emojiId: reaction.emoji.id,
      isCustom: reaction.emoji.id !== null,
      author: user.tag,
      authorId: user.id,
      authorAvatar: user.displayAvatarURL({ format: "png", dynamic: true }),
      messageAuthor: reaction.message.author?.tag || 'Unknown',
      messageContent: reaction.message.content || 'No content',
      messageId: reaction.message.id,
      timestamp: Date.now()
    };
  }

  // Get cache stats
  getStats() {
    return {
      snipes: this.snipes.size,
      editsnipes: this.editsnipes.size,
      reactionsnipes: this.reactionsnipes.size
    };
  }
}

// Export singleton instance
module.exports = new Snipe();
