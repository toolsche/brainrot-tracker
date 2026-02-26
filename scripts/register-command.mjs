import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env einlesen
const envPath = resolve(process.cwd(), '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const APP_ID = env.VITE_DISCORD_CLIENT_ID;
const BOT_TOKEN = env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN || BOT_TOKEN === 'dein_bot_token_hier') {
  console.error('Fehler: VITE_DISCORD_CLIENT_ID und DISCORD_BOT_TOKEN in .env setzen!');
  process.exit(1);
}

const command = {
  name: 'brainrot-info',
  description: 'Öffnet den Brainrot-Info Tracker',
  type: 4,       // PRIMARY_ENTRY_POINT
  handler: 2,    // DISCORD_LAUNCH_ACTIVITY
};

console.log(`Registriere Entry Point Command für App ${APP_ID}...`);

const res = await fetch(
  `https://discord.com/api/v10/applications/${APP_ID}/commands`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  }
);

const data = await res.json();

if (res.ok) {
  console.log('✓ Command registriert:', data.name, `(ID: ${data.id})`);
} else {
  console.error('✗ Fehler:', JSON.stringify(data, null, 2));
}
