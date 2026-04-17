const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [2, 'Username must be at least 2 characters'],
    maxlength: [20, 'Username must be 20 characters or fewer'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -'],
  },
  bestScore: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalPlays: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalDeaths: {
    type: Number,
    default: 0,
    min: 0,
  },
  bestCombo: {
    type: Number,
    default: 0,
    min: 0,
  },
  selectedSkin: {
    type: Number,
    default: 0,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
});

// Auto-update lastSeen on every save
playerSchema.pre('save', function (next) {
  this.lastSeen = new Date();
  next();
});

// Sanitised public view (exclude Mongoose internals)
playerSchema.methods.toPublic = function () {
  return {
    username: this.username,
    bestScore: this.bestScore,
    totalPlays: this.totalPlays,
    totalDeaths: this.totalDeaths,
    bestCombo: this.bestCombo,
    selectedSkin: this.selectedSkin,
    createdAt: this.createdAt,
    lastSeen: this.lastSeen,
  };
};

module.exports = mongoose.model('Player', playerSchema);
