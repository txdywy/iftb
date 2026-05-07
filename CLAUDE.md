# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**iftb** — A Chinese-language football title probability tracker for Europe's top 5 leagues (EPL, La Liga, Bundesliga, Serie A, Ligue 1). Fetches live standings and match data from football-data.org, computes title probabilities via a rule-based softmax model, and displays results as a dark-themed dashboard with ECharts trend charts.

## Commands

```bash
npm run dev          # Vite dev server (0.0.0.0)
npm run build        # tsc -b && vite build → dist/
npm run typecheck    # tsc -b --noEmit
npm run test         # vitest run (single run, jsdom env)
npm run preview      # Preview production build (0.0.0.0)

# Data pipeline (scripts/ via tsx)
npm run fetch:data      # Fetch live data from football-data.org (requires FOOTBALL_DATA_TOKEN env var)
npm run sample:data     # Generate synthetic sample data (no API key needed)
npm run validate:data   # Validate public/data/latest.json against schema rules
```

Run a single test: `npx vitest run tests/model.test.ts`

## Architecture

### Data Pipeline (Node scripts, run via tsx)

`scripts/update-data.ts` orchestrates the pipeline:
1. **Fetch** — `fetch-football-data.ts` calls football-data.org v4 API (`/competitions/{code}/standings` and `/matches`), downloads team crests and league emblems to `public/assets/`, adapts responses to internal `TeamStanding`/`Match` types.
2. **Calculate** — `calculate-title-probability.ts` computes title probabilities per league using weighted features (points-per-game 0.4, points-gap 0.25, goal-diff 0.2, recent-form 0.1, schedule-advantage 0.05), IQR-normalized then softmax-converted. Mathematically eliminated teams are zeroed out. Season-finished leagues lock the champion at 100%.
3. **Validate** — `validate-data.ts` checks structural integrity: 5 leagues, finite numbers, probabilities summing to 1.
4. **Write** — Outputs `public/data/latest.json` + timestamped history snapshot under `public/data/history/{YYYY}/{MM}/{DD}/{HHmm}.json` with a rolling `index.json` (max 240 entries).

Shared constants live in `scripts/shared.ts` (MODEL_VERSION, paths, sample data generator).

### Frontend (React 19 + Vite + Tailwind 3)

- **Routing** — react-router-dom v7: `/` → Dashboard, `/leagues/:leagueId` → LeaguePage.
- **Data loading** — `src/lib/data.ts` fetches `latest.json` and up to 40 history snapshots at startup; no backend API.
- **Charts** — ECharts with tree-shakeable imports (`echarts/core`), custom dark theme registered in `src/lib/chartTheme.ts` as `'iftb-dark'`. The `Chart` component wraps init/dispose lifecycle.
- **History trends** — `src/lib/history.ts` builds time-series for leader probability and per-team contender trends from snapshot arrays.
- **Pages** — `Dashboard.tsx` shows league cards with top contender bars and a cross-league leader trend chart. `LeaguePage.tsx` shows standings table, probability rankings, team detail drawer with model feature breakdown.

### Type System

All shared types are in `src/types.ts`: `Snapshot` → `LeagueSnapshot[]` → `TeamStanding[]`, `Match[]`, `TitleProbability[]` (with `ProbabilityFeatures`). `LeagueId` is a union of 5 string literals. The same types are imported by both frontend and scripts.

### Design Tokens

Tailwind custom theme in `tailwind.config.js`:
- Colors: `pitch-950/900/850/800` (dark greens), `line` (#6bf2b8 emerald accent), `cyanline`, `warning`, `danger`
- Fonts: Inter (sans), JetBrains Mono (mono)
- Shadow: `glow` with emerald tint

### CI/CD

GitHub Actions (`.github/workflows/`): scheduled data fetch (4x daily) → typecheck → test → build → deploy to GitHub Pages. Data changes auto-committed by the bot. `FOOTBALL_DATA_TOKEN` secret is required for scheduled/manual runs but optional for push-triggered builds (falls back to committed data).

## Key Conventions

- UI text is in Chinese (zh-CN); league names like 英超/西甲/德甲/意甲/法甲.
- League codes map to football-data.org competition codes: `epl→PL`, `laliga→PD`, `bundesliga→BL1`, `seriea→SA`, `ligue1→FL1`.
- Bundesliga has 34 max season games; all other leagues have 38.
- Vite `base: './'` for relative asset paths (GitHub Pages deployment).
- ECharts is chunked separately from React in the production build (`vite.config.ts` manualChunks).
