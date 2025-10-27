const mongoose = require('mongoose');

const sprintParticipantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  bookName: { type: String, required: true },
  startTab: { type: Number, required: true },
  currentTab: { type: Number, required: true },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const sprintSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  name: { type: String, default: null },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  participants: [sprintParticipantSchema],
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for finding active sprints
sprintSchema.index({ guildId: 1, isActive: 1 });

const Sprint = mongoose.model('Sprint', sprintSchema);

module.exports = { Sprint, schema: sprintSchema };
