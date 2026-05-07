import path from 'node:path';
import { calculateSnapshotProbabilities } from './calculate-title-probability';
import { fetchFootballDataLeagues } from './fetch-football-data';
import { fetchLeagueOdds } from './fetch-odds-data';
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

async function main() {
  const sample = process.argv.includes('--sample');
  const now = new Date();
  const previousLatest = await readJsonIfExists<Snapshot>(LATEST_PATH);
  const historyIndex = (await readJsonIfExists<HistoryIndex>(HISTORY_INDEX_PATH)) ?? { snapshots: [] };
  const previousSnapshots = previousLatest ? [previousLatest] : [];

  const baseSnapshot: Snapshot = sample
    ? sampleSnapshot(now)
    : {
        generatedAt: now.toISOString(),
        modelVersion: MODEL_VERSION,
        leagues: await fetchFootballDataLeagues(requiredToken(), now)
      };

  if (!sample) {
    const oddsByLeagueId = await fetchLeagueOdds(baseSnapshot.leagues);
    baseSnapshot.leagues = baseSnapshot.leagues.map((league) => {
      const odds = oddsByLeagueId.get(league.id);
      return odds ? { ...league, odds } : league;
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
