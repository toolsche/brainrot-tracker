import express from 'express';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { resolve } from 'path';
import Database from 'better-sqlite3';

// Load .env from project root
const envPath = resolve(import.meta.dirname, '../.env');
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 1) return;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  });
} catch { /* no .env file */ }

const CLIENT_ID     = process.env.VITE_DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const PORT          = process.env.PORT ?? 3001;
const USERDATA_FILE = resolve(import.meta.dirname, 'userdata.json');
const STATS_FILE    = resolve(import.meta.dirname, 'stats.json');
const DB_FILE       = resolve(import.meta.dirname, 'brainrot.db');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing VITE_DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET in .env');
  process.exit(1);
}

const DIST = resolve(import.meta.dirname, '../dist');

// --- SQLite setup ---
const db = new Database(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS userdata (
    discord_user_id TEXT PRIMARY KEY,
    username        TEXT,
    avatar          TEXT,
    index_data      TEXT NOT NULL,
    trading_data    TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )
`);

// Migration: userdata.json → SQLite (einmalig)
if (existsSync(USERDATA_FILE)) {
  try {
    const old = JSON.parse(readFileSync(USERDATA_FILE, 'utf-8'));
    const upsert = db.prepare(`
      INSERT OR IGNORE INTO userdata (discord_user_id, username, avatar, index_data, trading_data, updated_at)
      VALUES (@id, @username, @avatar, @index_data, @trading_data, @updated_at)
    `);
    const migrate = db.transaction((entries) => {
      for (const [id, row] of entries) {
        upsert.run({ id, username: row.username ?? 'Unbekannt', avatar: row.avatar ?? null, index_data: JSON.stringify(row.index ?? {}), trading_data: JSON.stringify(row.trading ?? {}), updated_at: row.updatedAt ?? new Date().toISOString() });
      }
    });
    migrate(Object.entries(old));
    renameSync(USERDATA_FILE, USERDATA_FILE + '.migrated');
    console.log('Migrated userdata.json → SQLite');
  } catch (e) { console.error('Migration failed:', e); }
}

const stmtUpsert = db.prepare(`
  INSERT INTO userdata (discord_user_id, username, avatar, index_data, trading_data, updated_at)
  VALUES (@id, @username, @avatar, @index_data, @trading_data, @updated_at)
  ON CONFLICT(discord_user_id) DO UPDATE SET
    username=excluded.username, avatar=excluded.avatar,
    index_data=excluded.index_data, trading_data=excluded.trading_data,
    updated_at=excluded.updated_at
`);

const stmtGetOne  = db.prepare('SELECT * FROM userdata WHERE discord_user_id = ?');
const stmtGetAll  = db.prepare('SELECT * FROM userdata');

const app = express();
app.use(express.json());

// --- Production: serve built frontend ---
app.use(express.static(DIST));

// --- Production: img-proxy (replaces Vite dev proxy) ---
app.get('/img-proxy/*', async (req, res) => {
  const imgPath = req.path.replace(/^\/img-proxy\//, '');
  const target = 'https://www.steal-a-brainrot.de/' + imgPath;
  try {
    const upstream = await fetch(target);
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

// --- Production: /.proxy/* aliases (replaces Vite dev proxy) ---
app.post('/.proxy/api/token',          (req, _res, next) => { req.url = '/api/token';    next('route'); });
app.post('/.proxy/api/userdata',       (req, _res, next) => { req.url = '/api/userdata'; next('route'); });
app.get( '/.proxy/api/userdata',       (req, _res, next) => { req.url = '/api/userdata'; next('route'); });
app.get( '/.proxy/api/userdata/:uid',  (req, _res, next) => { req.url = `/api/userdata/${req.params.uid}`; next('route'); });

app.post('/api/token', async (req, res) => {
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'missing code' });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('Discord token error:', data);
    return res.status(400).json({ error: data.error, description: data.error_description });
  }

  res.json({ access_token: data.access_token });
});

app.post('/api/userdata', (req, res) => {
  const { discordUserId, username, avatar, index, trading } = req.body ?? {};
  if (!discordUserId || !index || !trading) return res.status(400).json({ error: 'missing fields' });
  stmtUpsert.run({ id: discordUserId, username: username ?? 'Unbekannt', avatar: avatar ?? null, index_data: JSON.stringify(index), trading_data: JSON.stringify(trading), updated_at: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/api/userdata/:uid', (req, res) => {
  const row = stmtGetOne.get(req.params.uid);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ username: row.username, avatar: row.avatar, index: JSON.parse(row.index_data), trading: JSON.parse(row.trading_data), updatedAt: row.updated_at });
});

app.get('/api/userdata', (_req, res) => {
  const rows = stmtGetAll.all();
  const result = {};
  for (const row of rows) {
    result[row.discord_user_id] = { username: row.username, avatar: row.avatar, index: JSON.parse(row.index_data), trading: JSON.parse(row.trading_data), updatedAt: row.updated_at };
  }
  res.json(result);
});

// --- Stats ---
const BOT_PATTERN = /bot|crawler|spider|claudebot|gptbot|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|semrushbot|ahrefsbot|internet.measurement|oai-searchbot/i;

function isBot(ua) {
  return !ua || BOT_PATTERN.test(ua);
}

function readStats() {
  if (!existsSync(STATS_FILE)) return {};
  try { return JSON.parse(readFileSync(STATS_FILE, 'utf-8')); } catch { return {}; }
}

app.get('/api/stats', (_req, res) => {
  const stats = readStats();
  const result = { humans: {}, bots: {} };
  for (const [ip, entry] of Object.entries(stats)) {
    (isBot(entry.userAgent) ? result.bots : result.humans)[ip] = entry;
  }
  res.json(result);
});

// SPA catch-all: serve index.html + log visit
app.get('*', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.socket.remoteAddress ?? 'unknown';
  const ua = req.headers['user-agent'] ?? null;
  const stats = readStats();
  if (!stats[ip]) stats[ip] = { visits: 0, firstSeen: new Date().toISOString(), lastSeen: null, userAgent: null, bot: isBot(ua) };
  stats[ip].visits++;
  stats[ip].lastSeen = new Date().toISOString();
  stats[ip].userAgent = ua;
  stats[ip].bot = isBot(ua);
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  res.sendFile(resolve(DIST, 'index.html'));
});

app.listen(PORT, () => console.log(`Token server running on :${PORT}`));
