const mongoose = require('mongoose');

const storeItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  sellPrice: {
    type: Number,
    required: true,
    min: 0
  },
  emoji: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['banknotes', 'consumables', 'collectibles', 'tools']
  },
  stackable: {
    type: Boolean,
    default: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  // Banknote specific properties
  bankLimitIncrease: {
    type: Number,
    min: 0
  },
  // Future item type properties can be added here
  effects: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
storeItemSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
storeItemSchema.index({ category: 1, enabled: 1 });
storeItemSchema.index({ id: 1 });

module.exports = {
  schema: storeItemSchema,
  model: mongoose.model('StoreItem', storeItemSchema)
};