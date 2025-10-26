const mongoose = require('mongoose');

const spotifyAuthSessionSchema = new mongoose.Schema({
  stateToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true
  },
  guildId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Auto-delete after 10 minutes (600 seconds)
  }
});

// Create indexes for better performance
spotifyAuthSessionSchema.index({ stateToken: 1 });
spotifyAuthSessionSchema.index({ userId: 1 });
spotifyAuthSessionSchema.index({ createdAt: 1 }); // TTL index

module.exports = {
  schema: spotifyAuthSessionSchema,
  model: mongoose.model('SpotifyAuthSession', spotifyAuthSessionSchema)
};
