const express       = require('express');
const router        = express.Router();
const DailyChallenge = require('../models/DailyChallenge');
const PlayerProgress = require('../models/PlayerProgress');
const Player         = require('../models/Player');
const { authenticate } = require('../middleware/auth');
const { todayUTC }   = require('../models/DailyChallenge');

// ─── GET /api/daily-challenge ───────────────────────────────────────────────
// Returns today's challenges (generates them on first request of the day).
// No auth required — challenges are public.
router.get('/daily-challenge', async (req, res) => {
  try {
    const doc = await DailyChallenge.getTodayOrGenerate();
    return res.json({
      date:       doc.date,
      challenges: doc.challenges,
    });
  } catch (err) {
    console.error('[GET /api/daily-challenge]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/progress/:username ───────────────────────────────────────────
// Returns today's progress for a player. Returns zeroed progress if none.
// No auth required (read-only).
router.get('/progress/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const today    = todayUTC();

    const doc = await PlayerProgress.findOne({ username, date: today });

    return res.json({
      date:    today,
      username,
      progress: doc ? doc.progress : { score: 0, combo: 0, plays: 0 },
      completedChallenges: doc ? doc.completedChallenges : [],
    });
  } catch (err) {
    console.error('[GET /api/progress/:username]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/progress ────────────────────────────────────────────────────
// Called once per game-over. Updates the player's daily progress.
// Requires Authorization: Bearer <token>
//
// Body: { username: string, score: number, combo: number }
//   score — best score achieved in this game
//   combo — best combo achieved in this game
//   plays is ALWAYS incremented server-side by 1 (never trusted from client)
router.post('/progress', authenticate, async (req, res) => {
  try {
    const username = req.playerUsername;                 // validated by auth middleware
    const today    = todayUTC();

    // ── Validate + sanitise incoming values ────────────────────────────────
    let inScore = parseInt(req.body.score, 10) || 0;
    let inCombo = parseInt(req.body.combo, 10) || 0;

    // Hard caps — never trust values beyond what the game can produce
    inScore = Math.min(Math.max(inScore, 0), PlayerProgress.MAX_SCORE);
    inCombo = Math.min(Math.max(inCombo, 0), PlayerProgress.MAX_COMBO);

    // ── Verify player exists ───────────────────────────────────────────────
    const player = await Player.findOne({ username });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // ── Upsert today's progress doc ────────────────────────────────────────
    // findOneAndUpdate with upsert is atomic; prevents race conditions on
    // concurrent game-overs.
    let progress = await PlayerProgress.findOne({ username, date: today });

    if (!progress) {
      progress = new PlayerProgress({
        username,
        date: today,
        progress: { score: 0, combo: 0, plays: 0 },
        completedChallenges: [],
      });
    }

    // plays: always +1 (server-controlled, not client-controlled)
    progress.progress.plays += 1;

    // score/combo: only update if the new value is better
    if (inScore > progress.progress.score) {
      progress.progress.score = inScore;
    }
    if (inCombo > progress.progress.combo) {
      progress.progress.combo = inCombo;
    }

    // ── Evaluate challenge completions ─────────────────────────────────────
    const challengeDoc  = await DailyChallenge.getTodayOrGenerate();
    const newlyCompleted = [];

    for (const ch of challengeDoc.challenges) {
      // Skip if already awarded
      if (progress.completedChallenges.includes(ch.type)) continue;

      const met = isChallengeComplete(ch, progress.progress);
      if (met) {
        progress.completedChallenges.push(ch.type);
        newlyCompleted.push(ch.type);
      }
    }

    await progress.save();

    return res.json({
      date:    today,
      username,
      progress: progress.progress,
      completedChallenges: progress.completedChallenges,
      newlyCompleted,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Rare race on unique index — retry as a plain update
      return res.status(409).json({ error: 'Concurrent update conflict, please retry' });
    }
    console.error('[POST /api/progress]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Helper ────────────────────────────────────────────────────────────────
/**
 * Returns true if the stored progress satisfies the given challenge.
 * @param {{ type: string, target: number }} challenge
 * @param {{ score: number, combo: number, plays: number }} progress
 */
function isChallengeComplete(challenge, progress) {
  switch (challenge.type) {
    case 'score': return progress.score >= challenge.target;
    case 'combo': return progress.combo >= challenge.target;
    case 'plays': return progress.plays >= challenge.target;
    default:      return false;
  }
}

module.exports = router;
