import { ODDS_API_MATCH_MARKET, ODDS_API_SPORT_KEYS, normalizeOddsTeamName } from './shared';
import type { LeagueMatchOdds, LeagueSnapshot, MatchOdds, MatchOddsOutcome, TeamMarketSchedule } from '../src/types';

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4/sports';
const ODDS_API_REGIONS = 'eu,uk';
const ODDS_API_RATE_LIMIT_MS = 1000;
const ODDS_API_TIMEOUT_MS = 10000;

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  title: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export async function fetchLeagueMatchOdds(leagues: LeagueSnapshot[]): Promise<Map<string, LeagueMatchOdds>> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return new Map();

  const matchOddsByLeagueId = new Map<string, LeagueMatchOdds>();
  for (const league of leagues) {
    const sportKey = ODDS_API_SPORT_KEYS[league.id];
    if (!sportKey) continue;

    try {
      await sleep(ODDS_API_RATE_LIMIT_MS);
      const events = await requestMatchOddsApi(sportKey, apiKey);
      matchOddsByLeagueId.set(league.id, parseLeagueMatchOdds(league, events));
    } catch (error) {
      league.dataQuality.warnings.push(`Match odds unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return matchOddsByLeagueId;
}

async function requestMatchOddsApi(sportKey: string, apiKey: string): Promise<OddsApiEvent[]> {
  const url = new URL(`${ODDS_API_BASE_URL}/${sportKey}/odds`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', ODDS_API_REGIONS);
  url.searchParams.set('markets', ODDS_API_MATCH_MARKET);
  url.searchParams.set('oddsFormat', 'decimal');

  const response = await fetch(url, { signal: AbortSignal.timeout(ODDS_API_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`The Odds API ${sportKey} match odds returned ${response.status}`);
  return parseOddsApiEvents(await response.json());
}

export function parseLeagueMatchOdds(league: LeagueSnapshot, events: OddsApiEvent[]): LeagueMatchOdds {
  const matchedMatches: MatchOdds[] = [];
  const unmatchedNames = new Set<string>();
  let bookmakerCount = 0;
  let matchedOutcomeCount = 0;
  let unmatchedOutcomeCount = 0;

  for (const event of events) {
    const homeStanding = matchStanding(event.home_team, league);
    const awayStanding = matchStanding(event.away_team, league);
    if (!homeStanding || !awayStanding) {
      unmatchedNames.add(!homeStanding ? event.home_team : event.away_team);
      unmatchedOutcomeCount += 1;
      continue;
    }

    const marketOutcomes = consensusH2hOutcomes(event.bookmakers);
    if (!marketOutcomes.length) continue;

    const matchId = matchExistingFixtureId(event, league);
    if (matchId === undefined) continue;

    const eventBookmakerCount = event.bookmakers.filter((bookmaker) => bookmaker.markets.some((market) => market.key === ODDS_API_MATCH_MARKET)).length;
    bookmakerCount += eventBookmakerCount;
    matchedOutcomeCount += marketOutcomes.length;
    matchedMatches.push({
      matchId,
      utcDate: event.commence_time,
      homeTeamId: homeStanding.teamId,
      awayTeamId: awayStanding.teamId,
      homeTeamName: homeStanding.teamName,
      awayTeamName: awayStanding.teamName,
      outcomes: marketOutcomes,
      bookmakerCount: eventBookmakerCount
    });
  }

  const warnings = matchOddsWarnings(events, matchedMatches, unmatchedNames);
  if (warnings.length) league.dataQuality.warnings.push(`Match odds ${warnings.join(' | ')}`);

  return {
    leagueId: league.id,
    fetchedAt: new Date().toISOString(),
    source: 'the-odds-api',
    matches: matchedMatches,
    teamSchedules: aggregateTeamSchedules(league, matchedMatches),
    dataQuality: {
      bookmakerCount,
      matchedOutcomeCount,
      unmatchedOutcomeCount,
      coverageRatio: round(matchedMatches.length / Math.max(league.matches.filter((match) => match.status !== 'FINISHED').length, 1)),
      warnings
    }
  };
}

function consensusH2hOutcomes(bookmakers: OddsApiBookmaker[]): MatchOddsOutcome[] {
  const outcomeProbabilities = new Map<string, number[]>();
  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets.find((item) => item.key === ODDS_API_MATCH_MARKET);
    if (!market) continue;

    const overround = market.outcomes.reduce((sum, outcome) => sum + oddsToProbability(outcome.price), 0);
    if (overround <= 0) continue;

    for (const outcome of market.outcomes) {
      const probabilities = outcomeProbabilities.get(outcome.name) ?? [];
      probabilities.push(oddsToProbability(outcome.price) / overround);
      outcomeProbabilities.set(outcome.name, probabilities);
    }
  }

  return Array.from(outcomeProbabilities.entries()).map(([name, probabilities]) => ({
    name,
    oddsDecimal: round(1 / average(probabilities)),
    impliedProbability: round(average(probabilities))
  }));
}

function aggregateTeamSchedules(league: LeagueSnapshot, matchOdds: MatchOdds[]): TeamMarketSchedule[] {
  return league.standings
    .map((team) => {
      const teamMatches = matchOdds.filter((match) => match.homeTeamId === team.teamId || match.awayTeamId === team.teamId);
      const expectedPoints = teamMatches.reduce((sum, match) => sum + expectedPointsForTeam(team.teamId, match), 0);
      return {
        teamId: team.teamId,
        teamName: team.teamName,
        matches: teamMatches.length,
        expectedPoints: round(expectedPoints),
        expectedPpg: round(expectedPoints / Math.max(teamMatches.length, 1))
      };
    })
    .filter((team) => team.matches > 0)
    .sort((a, b) => b.expectedPpg - a.expectedPpg);
}

function expectedPointsForTeam(teamId: number, match: MatchOdds): number {
  const homeWin = match.outcomes.find((outcome) => normalizeOddsTeamName(outcome.name) === normalizeOddsTeamName(match.homeTeamName))?.impliedProbability ?? 0;
  const awayWin = match.outcomes.find((outcome) => normalizeOddsTeamName(outcome.name) === normalizeOddsTeamName(match.awayTeamName))?.impliedProbability ?? 0;
  const draw = match.outcomes.find((outcome) => normalizeOddsTeamName(outcome.name) === 'draw')?.impliedProbability ?? 0;
  if (teamId === match.homeTeamId) return homeWin * 3 + draw;
  if (teamId === match.awayTeamId) return awayWin * 3 + draw;
  return 0;
}

function matchExistingFixtureId(event: OddsApiEvent, league: LeagueSnapshot): number | undefined {
  const homeStanding = matchStanding(event.home_team, league);
  const awayStanding = matchStanding(event.away_team, league);
  return league.matches.find((match) => {
    return match.homeTeamId === homeStanding?.teamId && match.awayTeamId === awayStanding?.teamId && Math.abs(Date.parse(match.utcDate) - Date.parse(event.commence_time)) < 36 * 3600000;
  })?.id;
}

function matchOddsWarnings(events: OddsApiEvent[], matches: MatchOdds[], unmatchedNames: Set<string>): string[] {
  const warnings: string[] = [];
  if (!events.length) warnings.push('API returned no match odds events');
  else if (!matches.length) warnings.push('No match odds events matched fixtures');
  if (unmatchedNames.size) warnings.push(`Unmatched teams: ${Array.from(unmatchedNames).slice(0, 8).join(', ')}`);
  return warnings;
}

function parseOddsApiEvents(value: unknown): OddsApiEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map(readEvent).filter((event): event is OddsApiEvent => event !== null);
}

function readEvent(value: unknown): OddsApiEvent | null {
  const record = readRecord(value);
  const commenceTime = readString(record.commence_time);
  const homeTeam = readString(record.home_team);
  const awayTeam = readString(record.away_team);
  if (!commenceTime || !homeTeam || !awayTeam) return null;
  return {
    commence_time: commenceTime,
    home_team: homeTeam,
    away_team: awayTeam,
    bookmakers: readArray(record.bookmakers).map(readBookmaker).filter((bookmaker): bookmaker is OddsApiBookmaker => bookmaker !== null)
  };
}

function readBookmaker(value: unknown): OddsApiBookmaker | null {
  const record = readRecord(value);
  const title = readString(record.title);
  return {
    title: title || readString(record.key),
    markets: readArray(record.markets).map(readMarket).filter((market): market is OddsApiMarket => market !== null)
  };
}

function readMarket(value: unknown): OddsApiMarket | null {
  const record = readRecord(value);
  const key = readString(record.key);
  if (!key) return null;
  return {
    key,
    outcomes: readArray(record.outcomes).map(readOutcome).filter((outcome): outcome is OddsApiOutcome => outcome !== null)
  };
}

function readOutcome(value: unknown): OddsApiOutcome | null {
  const record = readRecord(value);
  const name = readString(record.name);
  const price = readNumber(record.price);
  if (!name || !Number.isFinite(price) || price <= 1) return null;
  return { name, price };
}

function matchStanding(teamName: string, league: LeagueSnapshot): LeagueSnapshot['standings'][number] | null {
  const normalized = normalizeOddsTeamName(teamName);
  return league.standings.find((standing) => normalizeOddsTeamName(standing.teamName) === normalized || normalizeOddsTeamName(standing.shortName) === normalized) ?? null;
}

function oddsToProbability(oddsDecimal: number): number {
  return oddsDecimal > 1 ? 1 / oddsDecimal : 0;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
