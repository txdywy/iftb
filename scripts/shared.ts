import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LEAGUES } from '../src/data/leagues';
import type { LeagueId, LeagueSnapshot, Match, Snapshot, TeamStanding } from '../src/types';

export const MODEL_VERSION = 'rule-softmax-v0.1.0';
export const DATA_ROOT = path.join(process.cwd(), 'public', 'data');
export const LATEST_PATH = path.join(DATA_ROOT, 'latest.json');
export const HISTORY_INDEX_PATH = path.join(DATA_ROOT, 'history', 'index.json');
export const LEAGUE_ASSET_ROOT = path.join(process.cwd(), 'public', 'assets', 'leagues');
export const TEAM_ASSET_ROOT = path.join(process.cwd(), 'public', 'assets', 'teams');

export const ODDS_API_SPORT_KEYS: Record<LeagueId, string> = {
  epl: 'soccer_epl',
  laliga: 'soccer_spain_la_liga',
  bundesliga: 'soccer_germany_bundesliga',
  seriea: 'soccer_italy_serie_a',
  ligue1: 'soccer_france_ligue_one'
};

export const ODDS_API_MARKET = 'outrights';
export const ODDS_API_MATCH_MARKET = 'h2h';

export { normalizeOddsTeamName } from '../src/lib/teamName';

export function currentSeasonLabel(now = new Date()): string {
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${year}-${year + 1}`;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function hashJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stableJson(value), 'utf8');
}

export function sampleSnapshot(now = new Date()): Snapshot {
  const generatedAt = now.toISOString();
  return {
    generatedAt,
    modelVersion: MODEL_VERSION,
    leagues: LEAGUES.map((league, leagueIndex) => {
      const names = sampleTeams[league.id];
      const standings: TeamStanding[] = names.map((name, index) => {
        const playedGames = league.id === 'bundesliga' ? 30 : 34;
        const points = Math.max(24, 82 - index * (index < 4 ? 4 + leagueIndex : 5) - leagueIndex);
        const won = Math.floor(points / 3);
        const draw = points - won * 3;
        const lost = Math.max(0, playedGames - won - draw);
        const goalsFor = 78 - index * 3 + leagueIndex;
        const goalsAgainst = 26 + index * 3;
        return {
          teamId: leagueIndex * 1000 + index + 1,
          teamName: name,
          shortName: name,
          position: index + 1,
          playedGames,
          won,
          draw,
          lost,
          goalsFor,
          goalsAgainst,
          goalDifference: goalsFor - goalsAgainst,
          points,
          form: index < 3 ? 'WWDWW' : 'LDWDL'
        };
      });
      const matches: Match[] = createSampleMatches(standings);
      return {
        id: league.id,
        name: league.name,
        country: league.country,
        code: league.code,
        emblem: `assets/leagues/${league.id}.svg`,
        season: currentSeasonLabel(now),
        standings,
        matches,
        titleProbabilities: [],
        topContenders: [],
        dataQuality: {
          status: 'ok',
          warnings: ['Sample data for local development'],
          standingsUpdatedAt: generatedAt,
          matchesUpdatedAt: generatedAt
        }
      } satisfies LeagueSnapshot;
    })
  };
}

const sampleTeams = {
  epl: ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea', 'Tottenham', 'Newcastle', 'Aston Villa', 'Manchester United'],
  laliga: ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Athletic Club', 'Villarreal', 'Real Betis', 'Real Sociedad', 'Girona'],
  bundesliga: ['Bayern Munich', 'Bayer Leverkusen', 'Borussia Dortmund', 'RB Leipzig', 'Stuttgart', 'Eintracht Frankfurt', 'Freiburg', 'Mainz'],
  seriea: ['Inter', 'Napoli', 'AC Milan', 'Juventus', 'Atalanta', 'Roma', 'Lazio', 'Bologna'],
  ligue1: ['Paris Saint-Germain', 'Marseille', 'Monaco', 'Lille', 'Nice', 'Lyon', 'Lens', 'Rennes']
} as const;

export const MAX_SEASON_GAMES: Record<string, number> = {
  bundesliga: 34,
  epl: 38,
  laliga: 38,
  seriea: 38,
  ligue1: 38
};

export function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function readNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}

export function readBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

export function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSampleMatches(standings: TeamStanding[]): Match[] {
  const matches: Match[] = [];
  let id = standings[0]?.teamId ? standings[0].teamId * 100 : 1;
  for (let i = 0; i < standings.length - 1; i += 2) {
    matches.push({
      id: id++,
      utcDate: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
      status: 'SCHEDULED',
      matchday: 35,
      homeTeamId: standings[i].teamId,
      homeTeamName: standings[i].teamName,
      awayTeamId: standings[i + 1].teamId,
      awayTeamName: standings[i + 1].teamName,
      homeScore: null,
      awayScore: null
    });
  }
  return matches;
}
