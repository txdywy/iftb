import path from 'node:path';
import { calculateSnapshotProbabilities } from './calculate-title-probability';
import { fetchFootballDataLeagues } from './fetch-football-data';
import { fetchLeagueOdds } from './fetch-odds-data';
import { fetchLeagueMatchOdds } from './fetch-match-odds-data';
import {
  DATA_ROOT,
  HISTORY_INDEX_PATH,
  LATEST_PATH,
  MODEL_VERSION,
  hashJson,
  readJsonIfExists,
  sampleSnapshot,
  stableJson,
  writeJson
} from './shared';
import { validateSnapshot } from './validate-data';
import type { HistoryIndex, Snapshot } from '../src/types';

// Enough recent snapshots to cover the 7-day delta window with margin
// (the scheduler runs ~4x/day, so 7 days ≈ 28 snapshots).
const DELTA_HISTORY_LIMIT = 60;

async function main() {
  const sample = process.argv.includes('--sample');
  const now = new Date();
  const previousLatest = await readJsonIfExists<Snapshot>(LATEST_PATH);
  const historyIndex = (await readJsonIfExists<HistoryIndex>(HISTORY_INDEX_PATH)) ?? { snapshots: [] };
  const previousSnapshots = await loadPreviousSnapshots(historyIndex, previousLatest);

  const baseSnapshot: Snapshot = sample
    ? sampleSnapshot(now)
    : {
        generatedAt: now.toISOString(),
        modelVersion: MODEL_VERSION,
        leagues: await fetchFootballDataLeagues(requiredToken(), now)
      };

  if (!sample) {
    const [oddsByLeagueId, matchOddsByLeagueId] = await Promise.all([
      fetchLeagueOdds(baseSnapshot.leagues),
      fetchLeagueMatchOdds(baseSnapshot.leagues)
    ]);
    baseSnapshot.leagues = baseSnapshot.leagues.map((league) => {
      const odds = oddsByLeagueId.get(league.id);
      const matchOdds = matchOddsByLeagueId.get(league.id);
      return { ...league, ...(odds ? { odds } : {}), ...(matchOdds ? { matchOdds } : {}) };
    });
  }

  const snapshot = calculateSnapshotProbabilities(baseSnapshot, previousSnapshots);
  const errors = validateSnapshot(snapshot);
  if (errors.length) {
    throw new Error(`Generated data is invalid:\n${errors.join('\n')}`);
  }

  const snapshotPath = historyPathFor(snapshot.generatedAt);
  const publicSnapshotPath = path.relative(path.join(process.cwd(), 'public'), snapshotPath).split(path.sep).join('/');
  const hash = hashJson(snapshot);
  const previousHash = previousLatest ? hashJson(previousLatest) : null;

  await writeJson(LATEST_PATH, snapshot);
  await writeJson(snapshotPath, snapshot);
  await writeJson(HISTORY_INDEX_PATH, {
    snapshots: [
      { generatedAt: snapshot.generatedAt, path: publicSnapshotPath, hash },
      ...historyIndex.snapshots.filter((entry) => entry.hash !== hash)
    ].slice(0, 240)
  } satisfies HistoryIndex);

  const warnings = snapshot.leagues.flatMap((league) => league.dataQuality.warnings.map((warning) => `${league.name}: ${warning}`));
  console.log(
    [
      `generatedAt=${snapshot.generatedAt}`,
      `leagues=${snapshot.leagues.length}`,
      `snapshotPath=${publicSnapshotPath}`,
      `hash=${hash}`,
      `changed=${previousHash !== hash}`,
      `warnings=${warnings.length ? warnings.join(' | ') : 'none'}`
    ].join('\n')
  );
}

function requiredToken(): string {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new Error('FOOTBALL_DATA_TOKEN is required unless running with --sample');
  }
  return token;
}

// Returns historical snapshots ordered oldest -> newest so the model can compute
// both the latest-snapshot delta and the week-over-week (7d) delta. Falls back to
// just the latest snapshot when the on-disk history cannot be read.
async function loadPreviousSnapshots(historyIndex: HistoryIndex, previousLatest: Snapshot | null): Promise<Snapshot[]> {
  const publicRoot = path.join(process.cwd(), 'public');
  const recentEntries = historyIndex.snapshots.slice(0, DELTA_HISTORY_LIMIT);
  const loaded = await Promise.all(
    recentEntries.map((entry) => readJsonIfExists<Snapshot>(path.join(publicRoot, entry.path)))
  );
  const snapshots = loaded.filter((snapshot): snapshot is Snapshot => snapshot !== null);

  if (previousLatest && !snapshots.some((snapshot) => snapshot.generatedAt === previousLatest.generatedAt)) {
    snapshots.push(previousLatest);
  }
  if (!snapshots.length) {
    return previousLatest ? [previousLatest] : [];
  }
  return snapshots.sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));
}

function historyPathFor(isoDate: string): string {
  const date = new Date(isoDate);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const time = `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return path.join(DATA_ROOT, 'history', year, month, day, `${time}.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
