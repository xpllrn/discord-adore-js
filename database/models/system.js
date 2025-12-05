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
  }
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

module.exports = {
  schema: systemSchema,
  model: mongoose.model('System', systemSchema)
};