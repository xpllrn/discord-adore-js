const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  GuildID: {
    type: String,
    required: true,
    unique: true
  },
  Prefix: {
    type: String,
    default: ','
  },
  // Welcome system (legacy fields for backward compatibility)
  WelcomeChannel: {
    type: String,
    default: null
  },
  WelcomeMessage: {
    type: String,
    default: null
  },
  // Welcome system (new multi-message support)
  WelcomeMessages: [{
    channelId: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Leave system (legacy fields for backward compatibility)
  LeaveChannel: {
    type: String,
    default: null
  },
  LeaveMessage: {
    type: String,
    default: null
  },
  // Leave system (new multi-message support)
  LeaveMessages: [{
    channelId: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Poj system (ping on join - auto-deleting messages)
  PojMessages: [{
    channelId: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Boost system (legacy fields for backward compatibility)
  BoostChannel: {
    type: String,
    default: null
  },
  BoostMessage: {
    type: String,
    default: null
  },
  BoostRole: {
    type: String,
    default: null
  },
  // Boost system (new multi-message support)
  BoostMessages: [{
    channelId: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Jail system
  JailRoleID: {
    type: String,
    default: null
  },
  JailChannelID: {
    type: String,
    default: null
  },
  // Vanity system
  Vanity: {
    type: String,
    default: null
  },
  VanityRoles: {
    type: [String],
    default: []
  },
  VanityMessage: {
    type: String,
    default: null
  },
  VanityLogChannel: {
    type: String,
    default: null
  },
  VanityDisabled: {
    type: Boolean,
    default: false
  },
  VanityDisabledReason: {
    type: String,
    default: null,
    maxlength: 500
  },
  VanityLastDisabled: {
    type: Date,
    default: null
  },
  // Auto roles
  AutoRoles: {
    type: [String],
    default: []
  },
  // Auto react
  AutoReact: [{
    word: {
      type: String,
      required: true
    },
    emojiId: {
      type: String,
      default: null
    },
    emojiName: {
      type: String,
      required: true
    },
    isCustom: {
      type: Boolean,
      default: false
    }
  }],
  // Auto responder
  AutoResponder: [{
    trigger: {
      type: String,
      required: true
    },
    response: {
      type: String,
      required: true
    },
    reply: {
      type: Boolean,
      default: false
    },
    strict: {
      type: Boolean,
      default: true
    },
    delete: {
      type: Boolean,
      default: false
    },
    selfDestruct: {
      type: Number,
      default: 0
    }
  }],
  // Force nick
  ForceNick: [{
    userId: {
      type: String,
      required: true
    },
    nickname: {
      type: String,
      required: true
    },
    setBy: {
      type: String,
      required: true
    },
    setAt: {
      type: Date,
      default: Date.now
    }
  }],
  // AFK system
  AFK: [{
    userId: {
      type: String,
      required: true
    },
    message: {
      type: String,
      default: 'AFK'
    },
    since: {
      type: Date,
      default: Date.now
    }
  }],

  // Moderation system
  Moderation: [{
    caseId: {
      type: Number,
      required: true
    },
    userId: {
      type: String,
      required: true
    },
    moderatorId: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true,
      enum: ['warn', 'unwarn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'jail', 'unjail', 'role_save', 'imute', 'iunmute', 'rmute', 'runmute']
    },
    reason: {
      type: String,
      required: true
    },
    duration: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // AutoMod Filter system
  AutoModFilter: {
    enabled: {
      type: Boolean,
      default: false
    },
    ruleId: {
      type: String,
      default: null
    },
    keywords: {
      type: [String],
      default: []
    },
    bypassRoles: {
      type: [String],
      default: []
    },
    action: {
      type: String,
      enum: ['delete', 'timeout', 'alert'],
      default: 'delete'
    },
    timeoutDuration: {
      type: Number,
      default: 300 // 5 minutes in seconds
    }
  },

  // Last.fm crowns system
  LastFMCrowns: [{
    artist: {
      type: String,
      required: true
    },
    userId: {
      type: String,
      required: true
    },
    plays: {
      type: Number,
      required: true
    },
    claimedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Swear tracking system (per server)
  SwearTracker: [{
    userId: {
      type: String,
      required: true
    },
    swears: [{
      word: {
        type: String,
        required: true
      },
      count: {
        type: Number,
        default: 1
      },
      lastUsed: {
        type: Date,
        default: Date.now
      }
    }],
    totalSwears: {
      type: Number,
      default: 0
    },
    todaySwears: {
      type: Number,
      default: 0
    },
    lastSwearDate: {
      type: Date,
      default: Date.now
    }
  }],

  // Guild name history tracking
  GuildNameHistory: [{
    oldName: {
      type: String,
      required: true
    },
    newName: {
      type: String,
      required: true
    },
    changedBy: {
      type: String,
      default: null // User ID who changed the name (if available)
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],



  // Message statistics tracking
  MessageStats: [{
    userId: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    count: {
      type: Number,
      default: 1
    }
  }],

  // Starboard system
  StarboardChannel: {
    type: String,
    default: null
  },
  StarboardThreshold: {
    type: Number,
    default: 3
  },
  StarboardEmoji: {
    type: String,
    default: '⭐'
  },
  StarboardMessages: [{
    originalMessageId: {
      type: String,
      required: true
    },
    starboardMessageId: {
      type: String,
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    authorId: {
      type: String,
      required: true
    },
    reactionCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Reminder system (guild-specific to prevent conflicts between bot instances)
  Reminders: [{
    id: {
      type: Number,
      required: true
    },
    userId: {
      type: String,
      required: true // User who set the reminder
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
    channelId: {
      type: String,
      required: true // Channel where reminder should be sent
    },
    messageUrl: {
      type: String,
      default: null
    }
  }],

  // Instance-specific permissions and settings
  // Removed InstanceSettings as we no longer use instance-based configuration

  // Logging system configuration
  LoggingConfig: [{
    channelId: {
      type: String,
      required: true // Channel ID where logs will be sent
    },
    webhookUrl: {
      type: String,
      required: true // Webhook URL for sending logs
    },
    logTypes: {
      type: [String],
      required: true,
      enum: ['moderator', 'message', 'events', 'members'], // Available log types
      validate: {
        validator: function (v) {
          return v && v.length > 0; // At least one log type must be selected
        },
        message: 'At least one log type must be selected'
      }
    },
    enabled: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      default: null // User ID who set up this logging config
    }
  }],

  // Voice Manager system
  VoiceManager: {
    enabled: {
      type: Boolean,
      default: false
    },
    categoryId: {
      type: String,
      default: null // Voice category ID
    },
    joinChannelId: {
      type: String,
      default: null // "Join 2 create" channel ID
    },
    mutedChannelId: {
      type: String,
      default: null // "muted" text channel ID
    },
    tempChannels: [{
      channelId: {
        type: String,
        required: true
      },
      ownerId: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      settings: {
        locked: {
          type: Boolean,
          default: false
        },
        hidden: {
          type: Boolean,
          default: false
        },
        userLimit: {
          type: Number,
          default: 0 // 0 means no limit
        },
        rejectedUsers: {
          type: [String],
          default: []
        },
        permittedUsers: {
          type: [String],
          default: []
        },
        customName: {
          type: String,
          default: null
        }
      }
    }],
    inviteCooldowns: [{
      userId: {
        type: String,
        required: true
      },
      channelId: {
        type: String,
        required: false,
        default: null
      },
      invitedUserId: {
        type: String,
        required: true
      },
      invitedAt: {
        type: Date,
        default: Date.now
      },
      hasJoined: {
        type: Boolean,
        default: false
      }
    }]
  },

  // Ticket system
  TicketSystem: {
    enabled: {
      type: Boolean,
      default: false
    },
    categoryId: {
      type: String,
      default: null
    },
    supportRoleId: {
      type: String,
      default: null
    },
    setupChannelId: {
      type: String,
      default: null
    },
    setupMessageId: {
      type: String,
      default: null
    },
    customMessage: {
      type: String,
      default: null
    },
    activeTickets: [{
      channelId: {
        type: String,
        required: true
      },
      userId: {
        type: String,
        required: true
      },
      ticketNumber: {
        type: Number,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open'
      },
      closedBy: {
        type: String,
        default: null
      },
      closedAt: {
        type: Date,
        default: null
      }
    }],
    ticketCounter: {
      type: Number,
      default: 0
    }
  },

  // Level system
  LevelSystem: {
    enabled: {
      type: Boolean,
      default: false
    },
    messageMode: {
      type: String,
      enum: ['none', 'channel', 'context'],
      default: 'context'
    },
    levelUpChannel: {
      type: String,
      default: null
    },
    customMessage: {
      type: String,
      default: null
    },
    levelRoles: [{
      level: {
        type: Number,
        required: true
      },
      roleId: {
        type: String,
        required: true
      }
    }],
    lastSyncTime: {
      type: Date,
      default: null
    }
  },

  // User level data (guild-specific)
  UserLevels: [{
    userId: {
      type: String,
      required: true
    },
    level: {
      type: Number,
      default: 1
    },
    experience: {
      type: Number,
      default: 0
    },
    lastMessageTime: {
      type: Date,
      default: null
    },
    // Voice tracking
    voiceJoinTime: {
      type: Date,
      default: null
    },
    lastVoiceXPTime: {
      type: Date,
      default: null
    }
  }],

  // Voice statistics tracking (time-based)
  VoiceStats: [{
    userId: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    minutes: {
      type: Number,
      default: 0
    }
  }],

  // Giveaway system
  Giveaways: [{
    id: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 256
    },
    description: {
      type: String,
      default: 'React with 🎉 to enter the giveaway.',
      maxlength: 1000
    },
    channelId: {
      type: String,
      required: true
    },
    messageId: {
      type: String,
      required: true
    },
    hostId: {
      type: String,
      required: true
    },
    winners: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    },
    endTime: {
      type: Date,
      required: true
    },
    requirements: {
      level: {
        type: Number,
        default: null
      },
      roleId: {
        type: String,
        default: null
      }
    },
    participants: [{
      type: String // User IDs
    }],
    winnerIds: [{
      type: String // User IDs of selected winners
    }],
    image: {
      type: String,
      default: null // URL for giveaway image
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Sticky Messages system
  StickyMessages: [{
    channelId: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    lastStickyMessageId: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Booster Role system
  BoosterRoleSystem: {
    baseRoleId: {
      type: String,
      default: null // The role that all booster roles will be positioned below
    },
    enabled: {
      type: Boolean,
      default: false // Whether the booster role system is enabled
    }
  },

  BoosterRoles: [{
    id: {
      type: Number,
      required: true
    },
    roleId: {
      type: String,
      required: true
    },
    ownerId: {
      type: String,
      required: true // User who owns this booster role
    },
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    color: {
      type: String,
      default: null // Hex color code
    },
    icon: {
      type: String,
      default: null // Icon URL or emoji
    },
    sharedWith: [{
      userId: {
        type: String,
        required: true
      },
      sharedAt: {
        type: Date,
        default: Date.now
      }
    }],
    pendingShares: [{
      userId: {
        type: String,
        required: true
      },
      messageId: {
        type: String,
        required: true // Message ID for accept/decline buttons
      },
      channelId: {
        type: String,
        required: true
      },
      sharedAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],

  // Boost tracking system
  BoostHistory: [{
    userId: {
      type: String,
      required: true
    },
    action: {
      type: String,
      enum: ['add', 'remove'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    // For 'remove' actions, store when the boost originally started
    boostStartTime: {
      type: Date,
      default: null
    }
  }],

  // Autopost system
  AutopostChannels: [{
    channelId: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      required: true
    },
    lastPosted: {
      type: Date,
      default: null
    }
  }],

  // Scheduled nuke system
  ScheduledNukes: [{
    id: {
      type: Number,
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    interval: {
      type: Number,
      required: true // Interval in milliseconds
    },
    message: {
      type: String,
      default: 'first',
      maxlength: 2000
    },
    nextNuke: {
      type: Date,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],

  // Booster role system
  BoosterRoles: [{
    // Support both old and new field names for backward compatibility
    userId: {
      type: String,
      required: false
    },
    ownerId: {
      type: String,
      required: false
    },
    roleId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    color: {
      type: String,
      default: null // Hex color code
    },
    icon: {
      type: String,
      default: null // Emoji or emoji ID
    },
    sharedWith: [{
      userId: {
        type: String,
        required: true
      },
      sharedAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
  }],
  Counting: {
    channelId: {
      type: String,
      default: null
    },
    currentCount: {
      type: Number,
      default: 0
    },
    lastCounterId: {
      type: String,
      default: null
    },
    strict: {
      type: Boolean,
      default: true
    }
  },

  // Reaction Roles system
  ReactionRoles: [{
    messageId: {
      type: String,
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    reaction: {
      type: String,
      required: true
    },
    roleId: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Button Roles system
  ButtonRoles: [{
    messageId: {
      type: String,
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    roleId: {
      type: String,
      required: true
    },
    buttonId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true,
      maxlength: 80
    },
    style: {
      type: String,
      required: true,
      enum: ['primary', 'secondary', 'success', 'danger']
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Webhooks system
  Webhooks: [{
    shortId: {
      type: String,
      required: true,
      maxlength: 4
    },
    name: {
      type: String,
      required: true,
      maxlength: 80
    },
    webhookId: {
      type: String,
      required: true
    },
    webhookToken: {
      type: String,
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    createdBy: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],

  // Sprints system (reading sprints)
  Sprints: [{
    messageId: {
      type: String,
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    roleId: {
      type: String,
      default: null
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    participants: [{
      userId: {
        type: String,
        required: true
      },
      username: {
        type: String,
        required: true
      },
      bookName: {
        type: String,
        required: true
      },
      startTab: {
        type: Number,
        required: true
      },
      currentTab: {
        type: Number,
        required: true
      },
      joinedAt: {
        type: Date,
        default: Date.now
      },
      isPaused: {
        type: Boolean,
        default: false
      },
      totalPausedTime: {
        type: Number,
        default: 0
      },
      lastPauseTime: {
        type: Date,
        default: null
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: String,
      required: true
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Antinuke system
  Antinuke: {
    enabled: {
      type: Boolean,
      default: false
    },
    whitelist: [{
      id: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['user', 'bot'],
        required: true
      },
      addedBy: {
        type: String,
        required: true
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    admins: [{
      userId: {
        type: String,
        required: true
      },
      addedBy: {
        type: String,
        required: true
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    modules: {
      role: {
        enabled: {
          type: Boolean,
          default: false
        },
        limit: {
          type: Number,
          default: 3,
          min: 1,
          max: 10
        },
        timeframe: {
          type: Number,
          default: 10000 // 10 seconds
        },
        punishment: {
          type: String,
          enum: ['strip', 'kick', 'ban'],
          default: 'strip'
        }
      },
      kick: {
        enabled: {
          type: Boolean,
          default: false
        },
        limit: {
          type: Number,
          default: 3,
          min: 1,
          max: 10
        },
        timeframe: {
          type: Number,
          default: 10000
        },
        punishment: {
          type: String,
          enum: ['strip', 'kick', 'ban'],
          default: 'strip'
        }
      },
      ban: {
        enabled: {
          type: Boolean,
          default: false
        },
        limit: {
          type: Number,
          default: 3,
          min: 1,
          max: 10
        },
        timeframe: {
          type: Number,
          default: 10000
        },
        punishment: {
          type: String,
          enum: ['strip', 'kick', 'ban'],
          default: 'strip'
        }
      },
      channel: {
        enabled: {
          type: Boolean,
          default: false
        },
        limit: {
          type: Number,
          default: 3,
          min: 1,
          max: 10
        },
        timeframe: {
          type: Number,
          default: 10000
        },
        punishment: {
          type: String,
          enum: ['strip', 'kick', 'ban'],
          default: 'strip'
        }
      },
      webhook: {
        enabled: {
          type: Boolean,
          default: false
        },
        limit: {
          type: Number,
          default: 3,
          min: 1,
          max: 10
        },
        timeframe: {
          type: Number,
          default: 10000
        },
        punishment: {
          type: String,
          enum: ['strip', 'kick', 'ban'],
          default: 'strip'
        }
      },
      botadd: {
        enabled: {
          type: Boolean,
          default: false
        },
        punishment: {
          type: String,
          enum: ['strip', 'kick', 'ban'],
          default: 'kick'
        }
      },
      permissions: {
        enabled: {
          type: Boolean,
          default: false
        },
        punishment: {
          type: String,
          enum: ['strip', 'kick', 'ban'],
          default: 'strip'
        },
        watched: [{
          type: String,
          enum: ['Administrator', 'BanMembers', 'KickMembers', 'ModerateMembers', 'MentionEveryone', 'ManageGuild', 'ManageChannels', 'ManageRoles', 'ManageWebhooks']
        }]
      }
    },
    logs: [{
      action: {
        type: String,
        required: true
      },
      userId: {
        type: String,
        required: true
      },
      details: {
        type: String,
        default: null
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Command Aliases - guild-wide shortcuts for commands
  Aliases: [{
    shortcut: {
      type: String,
      required: true
    },
    command: {
      type: String,
      required: true
    },
    createdBy: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Add validation and cleanup for BoosterRoles and VoiceManager
guildSchema.pre('validate', function () {
  if (this.BoosterRoles && this.BoosterRoles.length > 0) {
    // Filter out corrupted entries that have neither userId nor ownerId
    this.BoosterRoles = this.BoosterRoles.filter((role, index) => {
      const hasOwner = role.userId || role.ownerId;
      if (!hasOwner) {
        console.log(`Removing corrupted BoosterRole at index ${index}:`, role);
      }
      return hasOwner;
    });
  }

  // Clean up VoiceManager invite cooldowns
  if (this.VoiceManager && this.VoiceManager.inviteCooldowns && this.VoiceManager.inviteCooldowns.length > 0) {
    this.VoiceManager.inviteCooldowns = this.VoiceManager.inviteCooldowns.filter((cd, index) => {
      // Ensure required fields exist
      if (!cd.userId || !cd.invitedUserId) {
        console.log(`Removing invalid VoiceManager cooldown at index ${index}:`, cd);
        return false;
      }

      // Add missing channelId field
      if (!cd.hasOwnProperty('channelId')) {
        cd.channelId = null;
      }

      return true;
    });
  }


});

// Create indexes for better performance
guildSchema.index({ GuildID: 1 });

// Last.fm crowns indexes
guildSchema.index({ 'LastFMCrowns.artist': 1 });
guildSchema.index({ 'LastFMCrowns.userId': 1 });
guildSchema.index({ 'LastFMCrowns.artist': 1, 'LastFMCrowns.userId': 1 }); // Compound index for crown queries

// Logging system indexes
guildSchema.index({ 'LoggingConfig.channelId': 1 });
guildSchema.index({ 'LoggingConfig.logTypes': 1 });

// Message statistics indexes
guildSchema.index({ 'MessageStats.userId': 1 });
guildSchema.index({ 'MessageStats.date': 1 });
guildSchema.index({ 'MessageStats.userId': 1, 'MessageStats.date': 1 }); // Compound for user daily stats

// Voice statistics indexes
guildSchema.index({ 'VoiceStats.userId': 1 });
guildSchema.index({ 'VoiceStats.date': 1 });
guildSchema.index({ 'VoiceStats.userId': 1, 'VoiceStats.date': 1 }); // Compound for user daily stats

// Swear tracker indexes
guildSchema.index({ 'SwearTracker.userId': 1 });
guildSchema.index({ 'SwearTracker.date': 1 });
guildSchema.index({ 'SwearTracker.userId': 1, 'SwearTracker.date': 1 }); // Compound for user daily swears

// Starboard indexes
guildSchema.index({ 'StarboardMessages.originalMessageId': 1 });
guildSchema.index({ 'StarboardMessages.starboardMessageId': 1 });
guildSchema.index({ 'StarboardMessages.authorId': 1 });
guildSchema.index({ 'StarboardMessages.reactionCount': -1 }); // Descending for top starred messages

// Ticket system indexes
guildSchema.index({ 'TicketSystem.activeTickets.channelId': 1 });
guildSchema.index({ 'TicketSystem.activeTickets.userId': 1 });
guildSchema.index({ 'TicketSystem.activeTickets.status': 1 });
guildSchema.index({ 'TicketSystem.activeTickets.createdAt': -1 }); // Recent tickets first

// Voice management indexes
guildSchema.index({ 'VoiceManagement.tempChannels.channelId': 1 });
guildSchema.index({ 'VoiceManagement.tempChannels.ownerId': 1 });
guildSchema.index({ 'VoiceManagement.tempChannels.createdAt': -1 }); // Recent channels first

// Reminder system indexes
guildSchema.index({ 'Reminders.userId': 1 });
guildSchema.index({ 'Reminders.time': 1 }); // For finding due reminders
guildSchema.index({ 'Reminders.userId': 1, 'Reminders.time': 1 }); // Compound for user reminders

// Moderation case indexes
guildSchema.index({ 'Moderation.caseId': 1 });
guildSchema.index({ 'Moderation.userId': 1 });
guildSchema.index({ 'Moderation.moderatorId': 1 });
guildSchema.index({ 'Moderation.action': 1 });
guildSchema.index({ 'Moderation.timestamp': -1 }); // Recent cases first
guildSchema.index({ 'Moderation.userId': 1, 'Moderation.action': 1 }); // User action history

// Welcome/Leave system indexes (for message management)
guildSchema.index({ WelcomeChannel: 1 });
guildSchema.index({ LeaveChannel: 1 });
guildSchema.index({ BoostChannel: 1 });
guildSchema.index({ 'WelcomeMessages.channelId': 1 });
guildSchema.index({ 'LeaveMessages.channelId': 1 });
guildSchema.index({ 'BoostMessages.channelId': 1 });
guildSchema.index({ 'PojMessages.channelId': 1 });

// Level system indexes
guildSchema.index({ 'LevelSystem.enabled': 1 });
guildSchema.index({ 'LevelSystem.levelRoles.level': 1 });
guildSchema.index({ 'LevelSystem.levelRoles.roleId': 1 });
guildSchema.index({ 'UserLevels.userId': 1 });
guildSchema.index({ 'UserLevels.level': -1 }); // Descending for leaderboard
guildSchema.index({ 'UserLevels.userId': 1, 'UserLevels.level': -1 }); // Compound for user level queries

// Giveaway system indexes
guildSchema.index({ 'Giveaways.id': 1 });
guildSchema.index({ 'Giveaways.messageId': 1 });
guildSchema.index({ 'Giveaways.channelId': 1 });
guildSchema.index({ 'Giveaways.isActive': 1 });
guildSchema.index({ 'Giveaways.endTime': 1 }); // For automatic ending
guildSchema.index({ 'Giveaways.hostId': 1 });
guildSchema.index({ 'Giveaways.participants': 1 }); // For participant lookup

// Booster Role system indexes
guildSchema.index({ 'BoosterRoleSystem.baseRoleId': 1 });
guildSchema.index({ 'BoosterRoleSystem.enabled': 1 });
guildSchema.index({ 'BoosterRoles.id': 1 });
guildSchema.index({ 'BoosterRoles.roleId': 1 });
guildSchema.index({ 'BoosterRoles.ownerId': 1 });
guildSchema.index({ 'BoosterRoles.sharedWith.userId': 1 });
guildSchema.index({ 'BoosterRoles.pendingShares.userId': 1 });
guildSchema.index({ 'BoosterRoles.pendingShares.messageId': 1 });
guildSchema.index({ 'BoosterRoles.lastUsed': 1 }); // For cleanup

// Boost tracking indexes
guildSchema.index({ 'BoostHistory.userId': 1 });
guildSchema.index({ 'BoostHistory.action': 1 });
guildSchema.index({ 'BoostHistory.timestamp': -1 }); // Recent boost events first

// Autopost system indexes
guildSchema.index({ 'AutopostChannels.channelId': 1 });
guildSchema.index({ 'AutopostChannels.category': 1 });
guildSchema.index({ 'AutopostChannels.enabled': 1 });
guildSchema.index({ 'AutopostChannels.lastPosted': 1 });
guildSchema.index({ 'AutopostChannels.createdAt': -1 }); // Recent autopost channels first

// Scheduled nuke system indexes
guildSchema.index({ 'ScheduledNukes.id': 1 });
guildSchema.index({ 'ScheduledNukes.channelId': 1 });
guildSchema.index({ 'ScheduledNukes.nextNuke': 1 }); // For finding due nukes
guildSchema.index({ 'ScheduledNukes.enabled': 1 });

// Booster role system indexes
guildSchema.index({ 'BoosterRoles.ownerId': 1 });
guildSchema.index({ 'BoosterRoles.roleId': 1 });
guildSchema.index({ 'BoosterRoles.sharedWith.userId': 1 });
guildSchema.index({ 'BoosterRoles.createdAt': -1 }); // Recent booster roles first

// Sticky Messages indexes
guildSchema.index({ 'StickyMessages.channelId': 1 });
guildSchema.index({ 'StickyMessages.lastActivity': 1 }); // For inactivity checks
guildSchema.index({ 'StickyMessages.createdAt': -1 }); // Recent sticky messages first

// Reaction Roles indexes
guildSchema.index({ 'ReactionRoles.messageId': 1 });
guildSchema.index({ 'ReactionRoles.channelId': 1 });
guildSchema.index({ 'ReactionRoles.roleId': 1 });
guildSchema.index({ 'ReactionRoles.messageId': 1, 'ReactionRoles.reaction': 1 }); // Compound for message+reaction lookup

// Button Roles indexes
guildSchema.index({ 'ButtonRoles.messageId': 1 });
guildSchema.index({ 'ButtonRoles.channelId': 1 });
guildSchema.index({ 'ButtonRoles.roleId': 1 });
guildSchema.index({ 'ButtonRoles.buttonId': 1 }); // For button interaction lookup



// Webhooks indexes
guildSchema.index({ 'Webhooks.shortId': 1 });
guildSchema.index({ 'Webhooks.name': 1 });
guildSchema.index({ 'Webhooks.webhookId': 1 });
guildSchema.index({ 'Webhooks.createdBy': 1 });
guildSchema.index({ 'Webhooks.lastUsed': 1 });

// Sprints indexes
guildSchema.index({ 'Sprints.messageId': 1 });
guildSchema.index({ 'Sprints.channelId': 1 });
guildSchema.index({ 'Sprints.isActive': 1 });
guildSchema.index({ 'Sprints.endTime': 1 }); // For finding sprints that need to end
guildSchema.index({ 'Sprints.participants.userId': 1 });
guildSchema.index({ 'Sprints.createdAt': -1 }); // Recent sprints first

// Antinuke indexes
guildSchema.index({ 'Antinuke.enabled': 1 });
guildSchema.index({ 'Antinuke.whitelist.id': 1 });
guildSchema.index({ 'Antinuke.admins.userId': 1 });
guildSchema.index({ 'Antinuke.logs.timestamp': -1 }); // Recent logs first

// Aliases indexes
guildSchema.index({ 'Aliases.shortcut': 1 }); // Alias lookups

module.exports = {
  schema: guildSchema,
  model: mongoose.model('Guild', guildSchema)
};
