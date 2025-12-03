const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  UserID: {
    type: String,
    required: true,
    unique: true
  },
  SelfPrefix: {
    type: String,
    default: null
  },
  Timezone: {
    type: String,
    default: null
  },
  LastFMUsername: {
    type: String,
    default: null
  },

  TicTacToe: {
    wins: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    draws: {
      type: Number,
      default: 0
    }
  },

  // Gambling system
  Gambling: {
    wallet: {
      type: Number,
      default: 1000 // Starting wallet balance
    },
    bank: {
      type: Number,
      default: 0 // Starting bank balance
    },
    bankLimit: {
      type: Number
      // No default - let the application handle defaults
    },
    dailyClaim: {
      lastClaimed: {
        type: Date,
        default: null
      },
      streak: {
        type: Number,
        default: 0
      }
    },
    robCooldown: {
      type: Date,
      default: null
    },
    lastWorked: {
      type: Date,
      default: null
    },
    begCooldown: {
      type: Date,
      default: null
    },
    lastVote: {
      type: Date,
      default: null
    },
    totalVotes: {
      type: Number,
      default: 0
    },
    totalGambled: {
      type: Number,
      default: 0
    },
    totalWon: {
      type: Number,
      default: 0
    },
    totalLost: {
      type: Number,
      default: 0
    },
    luck: {
      type: Number,
      default: 0,
      min: -100,
      max: 100
    },
    lastCursed: {
      type: Date,
      default: null
    },
    lastPrayed: {
      type: Date,
      default: null
    }
  },
  // Roleplay interaction tracking
  Roleplay: {
    // Track interactions given by this user to others
    given: [{
      targetId: {
        type: String,
        required: true
      },
      action: {
        type: String,
        required: true
      },
      count: {
        type: Number,
        default: 1
      },
      lastInteraction: {
        type: Date,
        default: Date.now
      }
    }],
    // Track interactions received by this user from others
    received: [{
      fromId: {
        type: String,
        required: true
      },
      action: {
        type: String,
        required: true
      },
      count: {
        type: Number,
        default: 1
      },
      lastInteraction: {
        type: Date,
        default: Date.now
      }
    }]
  },
  // Personal notes system
  Notes: [{
    id: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500 // Limit note length
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Name history tracking
  NameHistory: [{
    type: {
      type: String,
      required: true,
      enum: ['username', 'displayname', 'nickname'] // Track different types of name changes
    },
    oldName: {
      type: String,
      required: true
    },
    newName: {
      type: String,
      required: true
    },
    guildId: {
      type: String,
      default: null // null for global changes (username/displayname), guildId for nickname changes
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Birthday data (global across all bot instances)
  Birthday: {
    day: {
      type: Number,
      min: 1,
      max: 31,
      default: null
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null
    },
    setAt: {
      type: Date,
      default: null
    }
  },

  // Personal reminders (user-specific to prevent conflicts between bot instances)
  Reminders: [{
    id: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500
    },
    duration: {
      type: Number,
      required: true // Duration in milliseconds
    },
    isDaily: {
      type: Boolean,
      default: false
    },
    nextTrigger: {
      type: Date,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    guildId: {
      type: String,
      default: null // Guild where reminder was created
    },
    channelId: {
      type: String,
      required: true // Channel where reminder should be sent
    },
    messageUrl: {
      type: String,
      default: null
    }
  }],

  // Spotify Integration
  SpotifyAccessToken: {
    type: String,
    default: null // Encrypted access token
  },
  SpotifyRefreshToken: {
    type: String,
    default: null // Encrypted refresh token
  },
  SpotifyTokenExpiry: {
    type: Date,
    default: null // When the access token expires
  },
  SpotifyUserId: {
    type: String,
    default: null // Spotify user ID
  },
  SpotifyLinkedAt: {
    type: Date,
    default: null // When the account was linked
  },
  // Spotify OAuth session (temporary)
  SpotifyAuthSession: {
    stateToken: {
      type: String,
      default: null
    },
    guildId: {
      type: String,
      default: null
    }
  },

  // Jail system - stores roles per guild when user is jailed
  JailedRoles: [{
    guildId: {
      type: String,
      required: true
    },
    roles: [{
      type: String
    }],
    savedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Marriage system
  Marriage: {
    partnerId: {
      type: String,
      default: null
    },
    marriedAt: {
      type: Date,
      default: null
    },
    ringId: {
      type: Number,
      default: null
    }
  },

  // Inventory system for store items
  Inventory: [{
    id: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    category: {
      type: String,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],



}, {
  timestamps: true
});

// Create indexes for better performance
userSchema.index({ UserID: 1 });

// Last.fm indexes
userSchema.index({ LastFMUsername: 1 });

// Spotify indexes
userSchema.index({ SpotifyUserId: 1 });
userSchema.index({ SpotifyLinkedAt: -1 }); // Recent Spotify links

// Gambling system indexes
userSchema.index({ 'Gambling.wallet': -1 }); // Richest users by wallet
userSchema.index({ 'Gambling.bank': -1 }); // Richest users by bank
userSchema.index({ 'Gambling.wallet': -1, 'Gambling.bank': -1 }); // Total wealth compound
userSchema.index({ 'Gambling.lastDaily': 1 }); // Daily cooldown tracking
userSchema.index({ 'Gambling.lastWeekly': 1 }); // Weekly cooldown tracking
userSchema.index({ 'Gambling.lastWork': 1 }); // Work cooldown tracking

// Birthday system indexes
userSchema.index({ 'Birthday.month': 1, 'Birthday.day': 1 }); // Birthday lookups
userSchema.index({ 'Birthday.timezone': 1 }); // Timezone-based birthday checks

// Tic-tac-toe game indexes
userSchema.index({ 'TicTacToe.wins': -1 }); // Leaderboard by wins
userSchema.index({ 'TicTacToe.losses': -1 }); // Leaderboard by losses
userSchema.index({ 'TicTacToe.draws': -1 }); // Leaderboard by draws



// Afk system indexes
userSchema.index({ 'Afk.isAfk': 1 }); // Find AFK users
userSchema.index({ 'Afk.since': -1 }); // Recent AFK users

// Timezone and prefix indexes
userSchema.index({ Timezone: 1 }); // Timezone-based queries
userSchema.index({ SelfPrefix: 1 }); // Custom prefix lookups

// Marriage system indexes
userSchema.index({ 'Marriage.partnerId': 1 }); // Find marriages
userSchema.index({ 'Marriage.marriedAt': -1 }); // Recent marriages

// Inventory system indexes
userSchema.index({ 'Inventory.id': 1 }); // Item lookups



module.exports = {
  schema: userSchema,
  model: mongoose.model('User', userSchema)
};
