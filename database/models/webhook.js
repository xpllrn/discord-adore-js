const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
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
}, {
  timestamps: true
});

// Create indexes for better performance
webhookSchema.index({ guildId: 1 });
webhookSchema.index({ guildId: 1, shortId: 1 });
webhookSchema.index({ guildId: 1, name: 1 });
webhookSchema.index({ webhookId: 1 });
webhookSchema.index({ createdBy: 1 });

module.exports = {
  schema: webhookSchema,
  model: mongoose.model('Webhook', webhookSchema)
};