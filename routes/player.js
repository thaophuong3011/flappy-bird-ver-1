const express = require('express');
const router  = express.Router();
const Player  = require('../models/Player');
const { authenticate } = require('../middleware/auth');

// ─── POST /api/player ──────────────────────────────────────────────────────
// Create a new player. Returns the player data + a session token.
// If the username already exists, returns the existing player (login flow).
router.post('/player', async (req, res) => {
  try {
    const rawUsername = (req.body.username || '').trim().toLowerCase();
    if (!rawUsername) {
      return res.status(400).json({ error: 'username is required' });
    }

    // Return existing player on re-login
    let player = await Player.findOne({ username: rawUsername });
    if (player) {
      player.lastSeen = new Date();
      await player.save();
      const token = generateToken(rawUsername);
      return res.status(200).json({ player: player.toPublic(), token, created: false });
    }

    // Create new player
    player = await Player.create({ username: rawUsername });
    const token = generateToken(rawUsername);
    return res.status(201).json({ player: player.toPublic(), token, created: true });

  } catch (err) {
    if (err.code === 11000) {
      // Race-condition duplicate: retry as login
      try {
        const player = await Player.findOne({ username: req.body.username.trim().toLowerCase() });
        const token  = generateToken(player.username);
        return res.status(200).json({ player: player.toPublic(), token, created: false });
      } catch (innerErr) {
        return res.status(500).json({ error: 'Failed to retrieve player' });
      }
    }
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ error: msg });
    }
    console.error('[POST /api/player]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/player/:username ─────────────────────────────────────────────
// Fetch a player's stats by username. No auth required (read-only).
router.get('/player/:username', async (req, res) => {
  try {
    const player = await Player.findOne({ username: req.params.username.toLowerCase() });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    return res.json({ player: player.toPublic() });
  } catch (err) {
    console.error('[GET /api/player/:username]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUT /api/player/:username ─────────────────────────────────────────────
// Update player stats after a game session.
// Requires Authorization: Bearer <token>
// Only fields that improve the record are overwritten (server-authoritative).
router.put('/player/:username', authenticate, async (req, res) => {
  try {
    const player = await Player.findOne({ username: req.playerUsername });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const { bestScore, totalPlays, totalDeaths, bestCombo, selectedSkin } = req.body;

    // bestScore & bestCombo: only update if the incoming value is higher
    if (typeof bestScore === 'number' && bestScore > player.bestScore) {
      player.bestScore = bestScore;
    }
    if (typeof bestCombo === 'number' && bestCombo > player.bestCombo) {
      player.bestCombo = bestCombo;
    }

    // Cumulative counters: add the delta sent by the client
    if (typeof totalPlays  === 'number' && totalPlays  > 0) player.totalPlays  += totalPlays;
    if (typeof totalDeaths === 'number' && totalDeaths > 0) player.totalDeaths += totalDeaths;

    // selectedSkin: simple overwrite
    if (typeof selectedSkin === 'number') {
      player.selectedSkin = selectedSkin;
    }

    await player.save();
    return res.json({ player: player.toPublic() });

  } catch (err) {
    console.error('[PUT /api/player/:username]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/leaderboard ──────────────────────────────────────────────────
// Returns top 10 players sorted by bestScore descending. No auth required.
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const top = await Player
      .find({ bestScore: { $gt: 0 } })
      .sort({ bestScore: -1, bestCombo: -1 })
      .limit(limit)
      .select('username bestScore totalPlays bestCombo -_id');

    // Add rank numbers
    const ranked = top.map((p, i) => ({
      rank:       i + 1,
      username:   p.username,
      bestScore:  p.bestScore,
      totalPlays: p.totalPlays,
      bestCombo:  p.bestCombo,
    }));

    return res.json({ leaderboard: ranked });
  } catch (err) {
    console.error('[GET /api/leaderboard]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Helper ────────────────────────────────────────────────────────────────
function generateToken(username) {
  const secret = process.env.AUTH_SECRET || 'flappy_super_secret_key_2024';
  return Buffer.from(`${username}:${secret}`).toString('base64');
}

module.exports = router;
