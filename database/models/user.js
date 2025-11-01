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
  // Last.fm library data
  LastFMLibrary: {
    artists: [{
      name: {
        type: String,
        required: true
      },
      plays: {
        type: Number,
        required: true,
        default: 0
      }
    }],
    albums: [{
      name: {
        type: String,
        required: true
      },
      artist: {
        type: String,
        required: true
      },
      plays: {
        type: Number,
        required: true,
        default: 0
      }
    }],
    tracks: [{
      name: {
        type: String,
        required: true
      },
      artist: {
        type: String,
        required: true
      },
      plays: {
        type: Number,
        required: true,
        default: 0
      }
    }],
    lastUpdated: {
      type: Date,
      default: null
    }
  },
  // Last.fm custom settings
  LastFMSettings: {
    customMode: {
      type: String,
      default: null
    },
    reactions: {
      upvote: {
        type: String,
        default: null
      },
      downvote: {
        type: String,
        default: null
      }
    }
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
  // UNO game statistics
  UnoStats: {
    gamesPlayed: {
      type: Number,
      default: 0
    },
    gamesWon: {
      type: Number,
      default: 0
    },
    gamesLost: {
      type: Number,
      default: 0
    },
    totalCardsPlayed: {
      type: Number,
      default: 0
    },
    fastestWin: {
      type: Number,
      default: null // Time in milliseconds
    },
    longestGame: {
      type: Number,
      default: null // Time in milliseconds
    },
    specialCardsPlayed: {
      skip: {
        type: Number,
        default: 0
      },
      reverse: {
        type: Number,
        default: 0
      },
      draw2: {
        type: Number,
        default: 0
      },
      wild: {
        type: Number,
        default: 0
      },
      wildDraw4: {
        type: Number,
        default: 0
      }
    },
    achievements: [{
      type: String
    }],
    lastPlayed: {
      type: Date,
      default: null
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
    lastInterestClaim: {
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

  // Sprint/Reading history
  SprintHistory: [{
    bookName: {
      type: String,
      required: true
    },
    tabsRead: {
      type: Number,
      required: true
    },
    completedAt: {
      type: Date,
      required: true
    },
    sprintId: {
      type: String,
      required: true
    }
  }]

}, {
  timestamps: true
});

// Create indexes for better performance
userSchema.index({ UserID: 1 });

// Last.fm indexes
userSchema.index({ LastFMUsername: 1 });
userSchema.index({ 'LastFMLibrary.artists.name': 1 });
userSchema.index({ 'LastFMLibrary.artists.plays': -1 }); // Top artists by plays
userSchema.index({ 'LastFMLibrary.albums.name': 1, 'LastFMLibrary.albums.artist': 1 });
userSchema.index({ 'LastFMLibrary.albums.plays': -1 }); // Top albums by plays
userSchema.index({ 'LastFMLibrary.tracks.name': 1, 'LastFMLibrary.tracks.artist': 1 });
userSchema.index({ 'LastFMLibrary.tracks.plays': -1 }); // Top tracks by plays
userSchema.index({ 'LastFMLibrary.lastUpdated': -1 }); // Recent library updates

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

// UNO game indexes
userSchema.index({ 'UnoStats.gamesPlayed': -1 }); // Most active players
userSchema.index({ 'UnoStats.gamesWon': -1 }); // Leaderboard by wins
userSchema.index({ 'UnoStats.totalCardsPlayed': -1 }); // Most cards played
userSchema.index({ 'UnoStats.fastestWin': 1 }); // Fastest wins
userSchema.index({ 'UnoStats.lastPlayed': -1 }); // Recent players

// Afk system indexes
userSchema.index({ 'Afk.isAfk': 1 }); // Find AFK users
userSchema.index({ 'Afk.since': -1 }); // Recent AFK users

// Timezone and prefix indexes
userSchema.index({ Timezone: 1 }); // Timezone-based queries
userSchema.index({ SelfPrefix: 1 }); // Custom prefix lookups

module.exports = {
  schema: userSchema,
  model: mongoose.model('User', userSchema)
};
