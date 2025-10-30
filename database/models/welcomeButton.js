const mongoose = require('mongoose');

const welcomeButtonSchema = new mongoose.Schema({
  interactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  guildId: {
    type: String,
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  }
}, {
  timestamps: true,
  collection: 'welcomeButtons'
});

// Compound index for efficient queries
welcomeButtonSchema.index({ guildId: 1, messageId: 1, userId: 1 });

module.exports = welcomeButtonSchema;