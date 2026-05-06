import { LEAGUES } from '../src/data/leagues';
import type { LeagueMeta } from '../src/data/leagues';
import type { LeagueSnapshot, Match, TeamStanding } from '../src/types';
import { currentSeasonLabel, seasonStartYear } from './shared';

interface FootballDataStandingResponse {
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
    status: string;
    matchday?: number;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
    score: { fullTime: { home: number | null; away: number | null } };
  }>;
}

export async function fetchFootballDataLeagues(token: string, now = new Date()): Promise<LeagueSnapshot[]> {
  return Promise.all(LEAGUES.map((league) => fetchLeague(league, token, now)));
}

async function fetchLeague(league: LeagueMeta, token: string, now: Date): Promise<LeagueSnapshot> {
  const season = seasonStartYear(now);
  const warnings: string[] = [];
  const [standingResponse, matchesResponse] = await Promise.all([
    requestFootballData<FootballDataStandingResponse>(`/competitions/${league.code}/standings?season=${season}`, token),
    requestFootballData<FootballDataMatchesResponse>(`/competitions/${league.code}/matches?season=${season}`, token)
  ]);

  const standings = adaptStandings(standingResponse);
  const matches = adaptMatches(matchesResponse);
  if (!standings.length) warnings.push('No standings returned');
  if (!matches.length) warnings.push('No matches returned');

  return {
    id: league.id,
    name: league.name,
    country: league.country,
    code: league.code,
    season: standingResponse.season?.startDate ? seasonLabelFromDate(standingResponse.season.startDate) : currentSeasonLabel(now),
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

async function requestFootballData<T>(pathname: string, token: string): Promise<T> {
  const response = await fetch(`https://api.football-data.org/v4${pathname}`, {
    headers: { 'X-Auth-Token': token }
  });
  if (!response.ok) {
    throw new Error(`football-data request failed ${response.status}: ${pathname}`);
  }
  return response.json() as Promise<T>;
}

export function adaptStandings(response: FootballDataStandingResponse): TeamStanding[] {
  const table = response.standings?.find((standing) => standing.type === 'TOTAL')?.table ?? [];
  return table.map((row) => ({
    teamId: row.team.id,
    teamName: row.team.name,
    shortName: row.team.shortName ?? row.team.name,
    crest: row.team.crest,
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
    homeTeamId: match.homeTeam.id,
    homeTeamName: match.homeTeam.name,
    awayTeamId: match.awayTeam.id,
    awayTeamName: match.awayTeam.name,
    homeScore: match.score.fullTime.home,
    awayScore: match.score.fullTime.away
  }));
}

function seasonLabelFromDate(startDate: string): string {
  const year = new Date(startDate).getUTCFullYear();
  return `${year}-${year + 1}`;
}
