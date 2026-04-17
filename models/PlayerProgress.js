const mongoose = require('mongoose');

// Max values we'll ever trust from the client (anti-cheat caps)
const MAX_SCORE = 999;
const MAX_COMBO = 10;   // matches COMBO_MAX in game frontend

const playerProgressSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  date: {
    type: String,       // 'YYYY-MM-DD' UTC
    required: true,
  },
  progress: {
    score: { type: Number, default: 0, min: 0, max: MAX_SCORE },
    combo: { type: Number, default: 0, min: 0, max: MAX_COMBO },
    plays: { type: Number, default: 0, min: 0 },
  },
  // Array of challenge types that have been awarded ('score', 'combo', 'plays')
  completedChallenges: {
    type: [String],
    default: [],
  },
  updatedAt: { type: Date, default: Date.now },
});

// Compound unique index: one progress doc per player per day
playerProgressSchema.index({ username: 1, date: 1 }, { unique: true });

// Auto-update updatedAt on save
playerProgressSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Expose caps for use in routes
playerProgressSchema.statics.MAX_SCORE = MAX_SCORE;
playerProgressSchema.statics.MAX_COMBO = MAX_COMBO;

module.exports = mongoose.model('PlayerProgress', playerProgressSchema);
