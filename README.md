# Vanguard DB — local Cardfight!! Vanguard card database + deck builder

A local-first web app for browsing cards and building decks from **every era** of
Cardfight!! Vanguard, starting with the pre-Limit Break era. No accounts, no servers,
no card assets included — you bring your own scans.

## Features

- **Card DB**: full-text search (name, skill, flavor, clan, nation, race, set…),
  filters, table / cards / grid / stacked views, group-by, era + set-kind navigation
- **Card viewer**: side preview (Upscaled art) + fullscreen lightbox, click-away to close
- **Deck builder (one page)**: search pool, deck list/grid/stacked views, hover preview,
  trigger/grade/clan stats, save/load, `.txt` + `.json` export/import
- **Legality engine**: 50-card main (starter counts), 4× by name, 16 triggers / 4 Heal,
  EN banlist presets per era-end + JP overlay + Custom date, Strict/Casual, clan-lock
  from enforcement set
- **Light + dark themes**, collapsible sidebar, resizable panes

## Bring your own CardDB (important)

This repo contains **zero Bushiroad assets** — no card images, no card text dumps.
You must supply a `CardDB` folder yourself:

```
<parent>/
  CardDB/
    [01] Original Era/
      [BT01] Descent of the King of Knights/
        Raw/          # card scans (any size; grids prefer these)
        Upscaled/     # high-res scans (preview + fullscreen)
        metadata.json # per-set card records (schema v2, see below)
      ...
  VanguardApp/        # this repo
```

Each set needs a `metadata.json` (list of card records). The fields the app uses:

- Identity: `card_number` (e.g. `BT01/001EN`), `file` (exact filename in `Raw/`),
  `set_code`, `name`
- Gameplay: `card_type`, `clan`, `nation`, `race`, `grade`, `power`, `critical`,
  `shield`, `skill_icons_raw`, `gift` (e.g. `"Critical Trigger +5000"` — this is
  where trigger kinds come from), `trigger_type`, `trigger_power`, `skill_text`,
  `flavor_text`
- Meta: `rarity`, `regulation`, `illustrator`, `source_url`

`npm run index` merges every set's `metadata.json` into the searchable index and
derives set kinds (Booster / Extra Booster / Trial Deck / Promo) plus featured cards.

## Quickstart

Prerequisites: **Node.js 20+**.

```bash
cd VanguardApp
npm install

# 1. Build the search index from your CardDB (re-run whenever you add sets)
npm run index

# 2. Start the image/data server (serves ../CardDB) — terminal 1
npm run server

# 3. Start the app — terminal 2
npm run dev
```

Open **http://localhost:5173**. (`npm run build` produces a static `dist/` for production.)

## Scripts

| Command        | What it does                                              |
| -------------- | --------------------------------------------------------- |
| `npm run index`  | Scan `../CardDB/**/metadata.json` → `public/data/*.json` |
| `npm run server` | Serve `../CardDB` images + `dist/` on `:3001`            |
| `npm run dev`    | Vite dev server on `:5173` (proxies images to `:3001`)   |
| `npm run build`  | Type-check + production build into `dist/`               |

## Notes

- Grids load `Raw/` images for speed; the side preview and lightbox prefer `Upscaled/`.
  Anything missing falls back to your own `CardDB/VanguardBack.png`, then a placeholder.
- Decks live in browser `localStorage`; use Export for backups/sharing.
- Banlist data (`src/lib/rules.ts`) encodes the EN restriction timeline plus the JP
  overlay discussed in `BAN_PRESETS` — update dates there as new eras are added.

## Roadmap

- Packaged desktop app (Electron) with a CardDB folder picker + in-app rescan
- More eras (Limit Break → Legion → G → V → D), G-zone support, more formats
