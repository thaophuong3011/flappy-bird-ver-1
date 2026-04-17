/**
 * Lightweight auth middleware.
 *
 * Token format (generated on the frontend):
 *   btoa(username + ':' + AUTH_SECRET)
 *
 * The server decodes it and checks:
 *   1. The embedded username matches the :username route param
 *   2. The embedded secret matches process.env.AUTH_SECRET
 *
 * This is intentionally simple — swap in jsonwebtoken later if needed.
 */

const SECRET = process.env.AUTH_SECRET || 'flappy_super_secret_key_2024';

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    // Tokens are base64-encoded "username:secret"
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) throw new Error('Bad format');

    const tokenUsername = decoded.slice(0, colonIdx);
    const tokenSecret   = decoded.slice(colonIdx + 1);

    // Accept username from URL param OR request body (for parameterless routes like POST /progress)
    const routeUsername = (req.params.username || req.body?.username || '').toLowerCase();

    if (tokenSecret !== SECRET) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    if (tokenUsername.toLowerCase() !== routeUsername) {
      return res.status(403).json({ error: 'Token does not match username' });
    }

    // Attach decoded username for downstream use
    req.playerUsername = tokenUsername.toLowerCase();
    next();
  } catch {
    return res.status(403).json({ error: 'Malformed token' });
  }
}

/**
 * Helper used by the frontend to generate a matching token.
 * (Not used server-side, provided here for documentation/copy-paste.)
 *
 * Frontend usage:
 *   const token = btoa(username + ':' + AUTH_SECRET);
 */

module.exports = { authenticate };
