/**
 * Universal finder utilities for Discord.js
 * Provides automatic closest match selection for roles, users, channels, and guilds
 */

/**
 * Universal role finder function with automatic closest match
 * @param {Guild} guild - The Discord guild
 * @param {string} roleInput - The role input (mention, ID, or name)
 * @returns {Object} - { found: boolean, role: Role|null, error: string|null }
 */
function findRole(guild, roleInput) {
  if (!guild || !roleInput) return { found: false, role: null, error: 'Invalid input' };

  // Try to find by mention first
  const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
  if (mentionMatch) {
    const role = guild.roles.cache.get(mentionMatch[1]);
    if (!role) {
      return { found: false, role: null, error: `Role with ID ${mentionMatch[1]} not found` };
    }
    // Validate that the role belongs to the current guild
    if (role.guild.id !== guild.id) {
      return { found: false, role: null, error: 'That role is not in this server' };
    }
    return { found: true, role };
  }

  // Try to find by ID
  let role = guild.roles.cache.get(roleInput);
  if (role) return { found: true, role };

  // Try to find by exact name (case-insensitive)
  role = guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());
  if (role) return { found: true, role };

  // Find closest match automatically
  const input = roleInput.toLowerCase();

  // Try partial matches (role name contains input or input contains role name)
  role = guild.roles.cache.find(r => {
    const roleName = r.name.toLowerCase();
    return roleName.includes(input) || input.includes(roleName);
  });
  if (role) return { found: true, role };

  // Try starting character matches (for inputs 3+ characters)
  if (input.length >= 3) {
    role = guild.roles.cache.find(r => r.name.toLowerCase().startsWith(input.substring(0, 3)));
    if (role) return { found: true, role };
  }

  return {
    found: false,
    role: null,
    error: `I was unable to find a **role** with the name: **${roleInput}**`
  };
}

/**
 * Universal user finder function with automatic closest match and global ID fallback
 * @param {Guild} guild - The Discord guild
 * @param {string} userInput - The user input (mention, ID, username, or display name)
 * @param {Client} client - Discord client (optional, for global user ID search)
 * @returns {Promise<Object>} - { found: boolean, user: GuildMember|User|null, error: string|null, isGlobal: boolean }
 */
async function findUser(guild, userInput, client = null) {
  if (!userInput) return { found: false, user: null, error: 'Invalid input', isGlobal: false };
  if (!guild) return { found: false, user: null, error: 'Invalid guild', isGlobal: false };

  // Try to find by mention first
  const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    const user = guild.members.cache.get(mentionMatch[1]);
    if (user) return { found: true, user, isGlobal: false };

    // If not found in guild and client provided, try global fetch
    if (client) {
      try {
        const globalUser = await client.users.fetch(mentionMatch[1]);
        return { found: true, user: globalUser, isGlobal: true };
      } catch {
        // Continue to error below
      }
    }
    return { found: false, user: null, error: `User with ID ${mentionMatch[1]} not found`, isGlobal: false };
  }

  // Try to find by ID in guild first
  let user = guild.members.cache.get(userInput);
  if (user) return { found: true, user, isGlobal: false };

  // Find closest match automatically with single iteration
  const input = userInput.toLowerCase();
  
  // Single iteration through members cache for all checks
  user = guild.members.cache.find(m => {
    const username = m.user.username.toLowerCase();
    const displayName = m.displayName.toLowerCase();
    
    // Exact matches first (highest priority)
    if (username === input || displayName === input) return true;
    
    // Partial matches
    if (username.includes(input) || input.includes(username)) return true;
    if (displayName.includes(input) || input.includes(displayName)) return true;
    
    // Starting character matches (for inputs 3+ characters)
    if (input.length >= 3) {
      const prefix = input.substring(0, 3);
      if (username.startsWith(prefix) || displayName.startsWith(prefix)) return true;
    }
    
    return false;
  });
  if (user) return { found: true, user, isGlobal: false };

  // If not found in guild and input looks like user ID, try global fetch
  if (client && /^\d{17,19}$/.test(userInput)) {
    try {
      const globalUser = await client.users.fetch(userInput);
      return { found: true, user: globalUser, isGlobal: true };
    } catch {
      // User not found globally either
    }
  }

  return {
    found: false,
    user: null,
    error: `I was unable to find a **user** with the name: **${userInput}**`,
    isGlobal: false
  };
}

/**
 * Universal channel finder function with automatic closest match
 * @param {Guild} guild - The Discord guild
 * @param {string} channelInput - The channel input (mention, ID, or name)
 * @returns {Object} - { found: boolean, channel: Channel|null, error: string|null }
 */
function findChannel(guild, channelInput) {
  if (!guild || !channelInput) return { found: false, channel: null, error: 'Invalid input' };

  // Try to find by mention first
  const mentionMatch = channelInput.match(/^<#(\d+)>$/);
  if (mentionMatch) {
    const channel = guild.channels.cache.get(mentionMatch[1]);
    if (!channel) {
      return { found: false, channel: null, error: `Channel with ID ${mentionMatch[1]} not found` };
    }
    // Validate that the channel belongs to the current guild
    if (channel.guild.id !== guild.id) {
      return { found: false, channel: null, error: 'That channel is not in this server' };
    }
    return { found: true, channel };
  }

  // Try to find by ID
  let channel = guild.channels.cache.get(channelInput);
  if (channel) return { found: true, channel };

  // Try to find by exact name (case-insensitive) - exclude only categories and voice channels
  channel = guild.channels.cache.find(ch =>
    ch.name.toLowerCase() === channelInput.toLowerCase() &&
    ch.type !== 2 && // Not voice channel
    ch.type !== 4    // Not category channel
  );
  if (channel) return { found: true, channel };

  // Find closest match automatically
  const input = channelInput.toLowerCase();

  // Try partial matches (channel name contains input or input contains channel name) - exclude only categories and voice channels
  channel = guild.channels.cache.find(ch => {
    const channelName = ch.name.toLowerCase();
    return (channelName.includes(input) || input.includes(channelName)) &&
      ch.type !== 2 && // Not voice channel
      ch.type !== 4;   // Not category channel
  });
  if (channel) return { found: true, channel };

  // Try starting character matches (for inputs 3+ characters) - exclude only categories and voice channels
  if (input.length >= 3) {
    channel = guild.channels.cache.find(ch =>
      ch.name.toLowerCase().startsWith(input.substring(0, 3)) &&
      ch.type !== 2 && // Not voice channel
      ch.type !== 4    // Not category channel
    );
    if (channel) return { found: true, channel };
  }

  return {
    found: false,
    channel: null,
    error: `I was unable to find a **channel** with the name: **${channelInput}**`
  };
}

/**
 * Universal guild finder function with automatic closest match
 * @param {Client} client - Discord client
 * @param {string} guildInput - The guild input (ID or name)
 * @returns {Promise<Object>} - { found: boolean, guild: Guild|null, error: string|null }
 */
async function findGuild(client, guildInput) {
  if (!client || !guildInput) return { found: false, guild: null, error: 'Invalid input' };

  // Try to find by ID first
  if (/^\d{17,19}$/.test(guildInput)) {
    try {
      const guild = await client.guilds.fetch(guildInput);
      return { found: true, guild };
    } catch (error) {
      return { found: false, guild: null, error: 'Server not found or bot is not in that server' };
    }
  }

  // Try to find by exact name (case-insensitive)
  let guild = client.guilds.cache.find(g => g.name.toLowerCase() === guildInput.toLowerCase());
  if (guild) return { found: true, guild };

  // Find closest match automatically
  const input = guildInput.toLowerCase();

  // Try partial matches (guild name contains input or input contains guild name)
  guild = client.guilds.cache.find(g => {
    const guildName = g.name.toLowerCase();
    return guildName.includes(input) || input.includes(guildName);
  });
  if (guild) return { found: true, guild };

  // Try starting character matches (for inputs 3+ characters)
  if (input.length >= 3) {
    guild = client.guilds.cache.find(g => g.name.toLowerCase().startsWith(input.substring(0, 3)));
    if (guild) return { found: true, guild };
  }

  return {
    found: false,
    guild: null,
    error: `I was unable to find a **server** with the name: **${guildInput}**`
  };
}

module.exports = {
  findRole,
  findUser,
  findChannel,
  findGuild
};
