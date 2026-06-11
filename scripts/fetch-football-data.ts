import { LEAGUES } from '../src/data/leagues';
import type { LeagueMeta } from '../src/data/leagues';
import type { LeagueSnapshot, Match, MatchStatus, TeamStanding } from '../src/types';
import { LEAGUE_ASSET_ROOT, TEAM_ASSET_ROOT, currentSeasonLabel, seasonStartYear, sleep } from './shared';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface FootballDataCompetitionResponse {
  id?: number;
  name?: string;
  code?: string;
  emblem?: string;
  area?: { name?: string };
  currentSeason?: { startDate?: string; endDate?: string };
}

interface FootballDataStandingResponse {
  competition?: FootballDataCompetitionResponse;
  season?: { startDate?: string; endDate?: string };
  standings?: Array<{
    type: string;
    table: Array<{
      position: number;
      team: { id: number; name: string; shortName?: string; crest?: string };
      playedGames: number;
      form?: string;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    }>;
  }>;
}

interface FootballDataMatchesResponse {
  matches?: Array<{
    id: number;
    utcDate: string;
    status: MatchStatus;
    matchday?: number;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
    score: { fullTime: { home: number | null; away: number | null } };
  }>;
}

export async function fetchFootballDataLeagues(token: string, now = new Date()): Promise<LeagueSnapshot[]> {
  const snapshots: LeagueSnapshot[] = [];
  for (const league of LEAGUES) {
    snapshots.push(await fetchLeague(league, token, now));
  }
  return snapshots;
}

async function fetchLeague(league: LeagueMeta, token: string, now: Date): Promise<LeagueSnapshot> {
  const season = seasonStartYear(now);
  const warnings: string[] = [];
  const standingResponse = await requestFootballData<FootballDataStandingResponse>(`/competitions/${league.code}/standings?season=${season}`, token);
  const matchesResponse = await requestFootballData<FootballDataMatchesResponse>(`/competitions/${league.code}/matches?season=${season}`, token);
  const competitionResponse = standingResponse.competition;

  const standings = await localizeTeamCrests(league, adaptStandings(standingResponse), warnings);
  const matches = adaptMatches(matchesResponse);
  const emblem = await resolveLeagueEmblem(league, competitionResponse?.emblem, warnings);
  if (!standings.length) warnings.push('No standings returned');
  if (!matches.length) warnings.push('No matches returned');

  return {
    id: league.id,
    name: competitionResponse?.name ?? league.name,
    country: competitionResponse?.area?.name ?? league.country,
    code: league.code,
    emblem,
    season: standingResponse.season?.startDate
      ? seasonLabelFromDate(standingResponse.season.startDate)
      : competitionResponse?.currentSeason?.startDate
        ? seasonLabelFromDate(competitionResponse.currentSeason.startDate)
        : currentSeasonLabel(now),
    standings,
    matches,
    titleProbabilities: [],
    topContenders: [],
    dataQuality: {
      status: warnings.length ? 'partial' : 'ok',
      warnings,
      standingsUpdatedAt: now.toISOString(),
      matchesUpdatedAt: now.toISOString()
    }
  };
}

async function resolveLeagueEmblem(league: LeagueMeta, emblemUrl: string | undefined, warnings: string[]): Promise<string> {
  const fallback = `assets/leagues/${league.id}.svg`;
  if (!emblemUrl) {
    warnings.push('No competition emblem returned');
    return fallback;
  }

  if (!isValidHttpsUrl(emblemUrl)) {
    warnings.push(`Competition emblem URL is not HTTPS: ${emblemUrl}`);
    return fallback;
  }

  try {
    const response = await fetch(emblemUrl);
    if (!response.ok) {
      warnings.push(`Competition emblem download failed: ${response.status}`);
      return fallback;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const extension = extensionFor(contentType, emblemUrl);
    const fileName = `${league.id}${extension}`;
    await mkdir(LEAGUE_ASSET_ROOT, { recursive: true });
    await writeFile(path.join(LEAGUE_ASSET_ROOT, fileName), Buffer.from(await response.arrayBuffer()));
    return `assets/leagues/${fileName}`;
  } catch (error) {
    warnings.push(`Competition emblem download failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return fallback;
  }
}

async function localizeTeamCrests(league: LeagueMeta, standings: TeamStanding[], warnings: string[]): Promise<TeamStanding[]> {
  const localized: TeamStanding[] = [];
  for (const standing of standings) {
    if (!standing.crest) {
      localized.push(standing);
      continue;
    }

    const localCrest = await downloadAsset({
      url: standing.crest,
      root: path.join(TEAM_ASSET_ROOT, league.id),
      publicRoot: `assets/teams/${league.id}`,
      basename: String(standing.teamId),
      warningLabel: `${standing.shortName} crest`,
      warnings
    });
    localized.push({ ...standing, crest: localCrest ?? standing.crest });
  }
  return localized;
}

function isValidHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function extensionFor(contentType: string, url: string): string {
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.png')) return '.png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return '.jpg';
  return '.svg';
}

async function downloadAsset({
  url,
  root,
  publicRoot,
  basename,
  warningLabel,
  warnings
}: {
  url: string;
  root: string;
  publicRoot: string;
  basename: string;
  warningLabel: string;
  warnings: string[];
}): Promise<string | null> {
  try {
    if (!isValidHttpsUrl(url)) return null;
    const response = await fetch(url);
    if (!response.ok) {
      warnings.push(`${warningLabel} download failed: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const extension = extensionFor(contentType, url);
    const fileName = `${basename}${extension}`;
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, fileName), Buffer.from(await response.arrayBuffer()));
    return `${publicRoot}/${fileName}`;
  } catch (error) {
    warnings.push(`${warningLabel} download failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  }
}

let lastRequestAt = 0;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

async function requestFootballData<T>(pathname: string, token: string): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await waitForRateLimitSlot();
      const url = `https://api.football-data.org/v4${pathname}`;
      if (!url.startsWith('https://api.football-data.org/v4/')) {
        throw new Error(`Invalid API URL: ${pathname}`);
      }
      const response = await fetch(url, {
        headers: { 'X-Auth-Token': token },
        signal: AbortSignal.timeout(30000)
      });
      lastRequestAt = Date.now();
      if (response.status === 429) {
        const resetSeconds = Number(response.headers.get('X-RequestCounter-Reset') ?? 60);
        await sleep((Number.isFinite(resetSeconds) ? resetSeconds : 60) * 1000 + 1000);
        continue; // retry after rate-limit cooldown
      }
      if (!response.ok) {
        throw new Error(`football-data request failed ${response.status}: ${pathname}`);
      }
      const data = await response.json();
      if (!data || typeof data !== 'object') {
        throw new Error(`football-data returned non-object response for ${pathname}`);
      }
      return data as T;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * 2 ** attempt;
        console.warn(`[fetch] attempt ${attempt + 1} failed for ${pathname}, retrying in ${delay}ms:`, error instanceof Error ? error.message : error);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error(`exhausted retries for ${pathname}`);
}

async function waitForRateLimitSlot(): Promise<void> {
  const delay = Number(process.env.FOOTBALL_DATA_REQUEST_DELAY_MS ?? 6500);
  if (!Number.isFinite(delay) || delay <= 0) return;
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < delay) {
    await sleep(delay - elapsed);
  }
}

export function adaptStandings(response: FootballDataStandingResponse): TeamStanding[] {
  const table = response.standings?.find((standing) => standing.type === 'TOTAL')?.table ?? [];
  return table.map((row) => ({
    teamId: row.team?.id ?? 0,
    teamName: row.team?.name ?? 'Unknown',
    shortName: row.team?.shortName ?? row.team?.name ?? 'Unknown',
    crest: row.team?.crest,
    position: row.position,
    playedGames: row.playedGames,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
    form: row.form
  }));
}

export function adaptMatches(response: FootballDataMatchesResponse): Match[] {
  return (response.matches ?? []).map((match) => ({
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    matchday: match.matchday,
    homeTeamId: match.homeTeam?.id ?? 0,
    homeTeamName: match.homeTeam?.name ?? 'Unknown',
    awayTeamId: match.awayTeam?.id ?? 0,
    awayTeamName: match.awayTeam?.name ?? 'Unknown',
    homeScore: match.score?.fullTime?.home ?? null,
    awayScore: match.score?.fullTime?.away ?? null
  }));
}

function seasonLabelFromDate(startDate: string): string {
  const year = new Date(startDate).getUTCFullYear();
  return `${year}-${year + 1}`;
}
