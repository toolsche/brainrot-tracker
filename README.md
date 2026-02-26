# Brainrot Tracker

Collection & trading tracker for the roblox game **Steal a Brainrot**, built as a Discord Activity (embedded app) and standalone web app.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- `@discord/embedded-app-sdk` for Discord Activity integration
- Express backend (`server/index.js`) for Discord OAuth token exchange

## Features

- Track collected items per variant (Normal, Gold, Diamond, Rainbow, Radioactive, Cursed, Candy, Lava, Galaxy, YinYang, Divine)
- Separate **Index** (what you have) and **Trading** (what you can give) modes
- Sort by value or name A–Z
- Filter by name
- Export to Discord-formatted text, grouped by rarity
- Works both inside Discord (Activity) and as a standalone website

## Setup

```bash
npm install
cp .env.example .env  # fill in VITE_DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET
```

## Development

Two processes need to run simultaneously:

```bash
npm run dev     # Vite dev server at http://localhost:5173
npm run server  # Express token server at http://localhost:3001
```

## Build

```bash
npm run build   # type-check + production build → dist/
npm run preview # serve dist/ locally
```

## Data

All item data lives in `src/data/brainrot_db.json`. Each item has:

```ts
{
  id: number,
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythical" | "Brainrot God" | "Secret",
  kosten: number,
  wert: number,
  image: string,
  fixed_sets?: string[],  // limits item to specific variants (Candy/Lava/Galaxy)
  type?: string[]
}
```

User data is stored in `localStorage` — keyed by Discord user ID in Activity mode, anonymous in web mode.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord application client secret (server-side only) |
