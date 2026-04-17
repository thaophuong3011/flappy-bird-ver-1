require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const playerRoutes = require('./routes/player');
const challengeRoutes = require('./routes/challenge');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ──────────────────────────────────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── BODY PARSERS ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── REQUEST LOGGER (dev) ──────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime().toFixed(1) + 's',
  });
});

// ─── API ROUTES ────────────────────────────────────────────────────────────
app.use('/api', playerRoutes);
app.use('/api', challengeRoutes);

// ─── 404 FALLBACK ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── MONGODB + START ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flappybird';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Flappy Bird API running on http://localhost:${PORT}`);
      console.log(`    Health: http://localhost:${PORT}/health`);
      console.log(`    CORS origin: ${corsOrigin}`);
    });
  })
  .catch(err => {
    console.error(' MongoDB connection failed:', err.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('\n  MongoDB disconnected. Bye!');
  process.exit(0);
});
