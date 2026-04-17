const mongoose = require('mongoose');

// ─── Challenge Pool ─────────────────────────────────────────────────────────
// Each entry has a type, a set of possible targets, and a label template.
const CHALLENGE_POOL = {
  score: {
    targets: [5, 10, 15, 20, 30],
    label: (t) => `Reach a score of ${t} in one game`,
    icon: '★',
  },
  combo: {
    targets: [2, 3, 5, 8],
    label: (t) => `Achieve a ×${t} combo in one game`,
    icon: '⚡',
  },
  plays: {
    targets: [2, 3, 5],
    label: (t) => `Play ${t} games today`,
    icon: '▶',
  },
};

// ─── Schema ─────────────────────────────────────────────────────────────────
const challengeItemSchema = new mongoose.Schema({
  type:   { type: String, enum: ['score', 'combo', 'plays'], required: true },
  target: { type: Number, required: true, min: 1 },
  label:  { type: String, required: true },
  icon:   { type: String, default: '★' },
}, { _id: false });

const dailyChallengeSchema = new mongoose.Schema({
  date: {
    type: String,     // 'YYYY-MM-DD' UTC
    unique: true,
    required: true,
    index: true,
  },
  challenges: [challengeItemSchema],
  createdAt: { type: Date, default: Date.now, immutable: true },
});

// ─── Static: generate (or return existing) today's challenges ───────────────
dailyChallengeSchema.statics.getTodayOrGenerate = async function () {
  const today = todayUTC();

  // Try to find existing
  const existing = await this.findOne({ date: today });
  if (existing) return existing;

  // Generate deterministically from today's date (no randomness edge cases)
  const challenges = generateChallenges(today);

  // Upsert (race-condition safe)
  const doc = await this.findOneAndUpdate(
    { date: today },
    { $setOnInsert: { date: today, challenges } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function todayUTC() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Deterministic daily challenge generator.
 * Uses the numeric date as a seed so the same day always gives the same set.
 */
function generateChallenges(dateStr) {
  // Simple seeded PRNG (mulberry32)
  const seed = dateStr.replace(/-/g, '') | 0; // e.g. 20260417
  let s = seed;
  const rand = () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const types = Object.keys(CHALLENGE_POOL);

  // Always include 1 'plays' challenge + 1–2 random others
  const chosen = new Set(['plays']);
  while (chosen.size < Math.floor(rand() * 2) + 2) {      // 2 or 3 total
    chosen.add(types[Math.floor(rand() * types.length)]);
  }

  return [...chosen].map((type) => {
    const pool = CHALLENGE_POOL[type];
    const target = pool.targets[Math.floor(rand() * pool.targets.length)];
    return {
      type,
      target,
      label: pool.label(target),
      icon: pool.icon,
    };
  });
}

module.exports = mongoose.model('DailyChallenge', dailyChallengeSchema);
module.exports.todayUTC = todayUTC;
