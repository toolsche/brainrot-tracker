# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR (http://localhost:5173)
npm run build     # Type-check (tsc -b) then build for production
npm run lint      # Run ESLint across all TS/TSX files
npm run preview   # Serve dist/ to test the production build
```

There is no test runner configured — the `test/` directory exists but is empty.

## Architecture

This is a **Discord embedded app** (Activity) built with React 19 + TypeScript + Vite + Tailwind CSS 4. It's a collection/trading tracker for a collectible game called "Brainrot".

### Data Layer

All item data lives in `src/data/brainrot_db.json` (~3000 lines). Each key is an item name mapping to:

```typescript
{
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythical" | "Brainrot God" | "Secret",
  kosten: number,       // purchase cost
  wert: number,         // value — used as the primary sort key
  image: string,        // URL to item image (steal-a-brainrot.de)
  fixed_sets?: string[], // if present, item only exists in these variants
  type?: string[]       // e.g. ["Fuse", "Witch", "Fishing"]
}
```

User state is persisted to **localStorage** under two keys:
- `brainrot_index` — items the user has collected
- `brainrot_trading` — items the user can trade

Both store `Record<itemName, variantName[]>`.

### Component Structure

```
main.tsx → App.tsx → BrainrotIndex.tsx
```

`BrainrotIndex.tsx` is the single large component doing everything:
- **10 variants**: Normal, Gold, Diamond, Rainbow, Radioactive, Cursed, Candy, Lava, Galaxy, YinYang
- Four variants (Candy, Lava, Galaxy, YinYang) are "legacy" — only items with a matching `fixed_sets` entry appear in them
- **Two modes** toggled by a button: INDEX (what you have) vs TRADING (what you can give)
- Items are filtered by search text and active variant, sorted by `wert` descending, all via `useMemo`
- Clicking an item card toggles the active variant in/out of that item's stored array
- The export button generates a Discord-formatted text block ("BRAUCHE ICH" in INDEX mode, "KANN ICH GEBEN" in TRADING mode) and copies it to the clipboard

### Discord Integration

`@discord/embedded-app-sdk` is installed. The SDK instance should be initialized before rendering. Check `src/main.tsx` or `src/App.tsx` for where `DiscordSDK` is set up.

## TypeScript Config

- Strict mode is on — unused variables and parameters are errors
- App target: ES2022; build tools target: ES2023
- JSX uses the React 17+ automatic runtime (`react-jsx`), so no need to `import React` in every file

## Tailwind

Uses Tailwind CSS v4 with the `@tailwindcss/vite` plugin — configuration via `tailwind.config.js` scans `index.html` and `src/**/*.{ts,tsx}`.
