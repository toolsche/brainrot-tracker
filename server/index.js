import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing VITE_DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET in .env');
  process.exit(1);
}

const app = express();
app.use(express.json());

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

function readUserdata() {
  if (!existsSync(USERDATA_FILE)) return {};
  try { return JSON.parse(readFileSync(USERDATA_FILE, 'utf-8')); } catch { return {}; }
}

function writeUserdata(data) {
  writeFileSync(USERDATA_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/userdata', (req, res) => {
  const { discordUserId, username, avatar, index, trading } = req.body ?? {};
  if (!discordUserId || !index || !trading) return res.status(400).json({ error: 'missing fields' });

  const data = readUserdata();
  data[discordUserId] = { username: username ?? 'Unbekannt', avatar: avatar ?? null, index, trading, updatedAt: new Date().toISOString() };
  writeUserdata(data);
  res.json({ ok: true });
});

app.get('/api/userdata', (_req, res) => {
  res.json(readUserdata());
});

app.listen(PORT, () => console.log(`Token server running on :${PORT}`));
