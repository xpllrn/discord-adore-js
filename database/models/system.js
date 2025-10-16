const mongoose = require('mongoose');

const systemSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'system'
  },
  Blacklist: {
    users: [{
      userId: {
        type: String,
        required: true
      },
      reason: {
        type: String,
        default: '...'
      },
      blacklistedBy: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    servers: [{
      serverId: {
        type: String,
        required: true
      },
      reason: {
        type: String,
        default: '...'
      },
      blacklistedBy: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Instance-specific bot configuration
  InstanceConfig: [{
    instanceId: {
      type: String,
      required: true // Bot instance ID (user ID of bot owner)
    },
    botName: {
      type: String,
      default: null // Custom bot name
    },
    bio: {
      type: String,
      default: null // Custom bot bio/description
    },
    botStatus: {
      activity: {
        type: String,
        default: null // Activity text
      },
      type: {
        type: String,
        enum: ['Playing', 'Streaming', 'Listening', 'Watching', 'Competing'],
        default: 'Watching'
      },
      status: {
        type: String,
        enum: ['online', 'idle', 'dnd', 'invisible'],
        default: 'online'
      }
    },
    permissions: {
      type: [String],
      default: [] // Array of permission strings for this instance owner
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create indexes for better performance
// Note: _id index is automatically created by MongoDB

// Blacklist indexes
systemSchema.index({ 'Blacklist.users.userId': 1 });
systemSchema.index({ 'Blacklist.servers.serverId': 1 });
systemSchema.index({ 'Blacklist.users.blacklistedBy': 1 });
systemSchema.index({ 'Blacklist.servers.blacklistedBy': 1 });
systemSchema.index({ 'Blacklist.users.timestamp': -1 }); // Recent blacklists first
systemSchema.index({ 'Blacklist.servers.timestamp': -1 }); // Recent blacklists first

// Instance configuration indexes
systemSchema.index({ 'InstanceConfig.instanceId': 1 });
systemSchema.index({ 'InstanceConfig.botName': 1 });
systemSchema.index({ 'InstanceConfig.createdAt': -1 }); // Recent instances first

module.exports = mongoose.model('System', systemSchema);