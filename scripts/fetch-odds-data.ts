import { ODDS_API_MARKET, ODDS_API_SPORT_KEYS } from './shared';
import type { BookmakerOdds, LeagueOdds, LeagueSnapshot, TeamOdds } from '../src/types';

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4/sports';
const ODDS_API_REGIONS = 'eu,uk';
const ODDS_API_RATE_LIMIT_MS = 1000;
const ODDS_API_TIMEOUT_MS = 10000;
const MIN_MAPPED_OUTCOMES = 3;

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  bookmakers: OddsApiBookmaker[];
}

export async function fetchLeagueOdds(leagues: LeagueSnapshot[]): Promise<Map<string, LeagueOdds>> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return new Map();

  const oddsByLeagueId = new Map<string, LeagueOdds>();
  for (const league of leagues) {
    const sportKey = ODDS_API_SPORT_KEYS[league.id];
    if (!sportKey) continue;

    try {
      await sleep(ODDS_API_RATE_LIMIT_MS);
      const events = await requestOddsApi(sportKey, apiKey);
      const odds = parseLeagueOdds(league, events);
      oddsByLeagueId.set(league.id, odds);
    } catch (error) {
      league.dataQuality.warnings.push(`Odds unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return oddsByLeagueId;
}

async function requestOddsApi(sportKey: string, apiKey: string): Promise<OddsApiEvent[]> {
  const url = new URL(`${ODDS_API_BASE_URL}/${sportKey}/odds`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', ODDS_API_REGIONS);
  url.searchParams.set('markets', ODDS_API_MARKET);
  url.searchParams.set('oddsFormat', 'decimal');

  const response = await fetch(url, { signal: AbortSignal.timeout(ODDS_API_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`The Odds API ${sportKey} returned ${response.status}`);
  }
  return parseOddsApiEvents(await response.json());
}

function parseOddsApiEvents(value: unknown): OddsApiEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map((event) => ({
    bookmakers: readArray(readRecord(event).bookmakers)
      .map(readBookmaker)
      .filter((bookmaker): bookmaker is OddsApiBookmaker => bookmaker !== null)
  }));
}

function readBookmaker(value: unknown): OddsApiBookmaker | null {
  const record = readRecord(value);
  const key = readString(record.key);
  const title = readString(record.title);
  const lastUpdate = readString(record.last_update);
  if (!key || !lastUpdate || !Number.isFinite(Date.parse(lastUpdate))) return null;

  return {
    key,
    title: title || key,
    last_update: lastUpdate,
    markets: readArray(record.markets)
      .map(readMarket)
      .filter((market): market is OddsApiMarket => market !== null)
  };
}

function readMarket(value: unknown): OddsApiMarket | null {
  const record = readRecord(value);
  const key = readString(record.key);
  if (!key) return null;
  return {
    key,
    outcomes: readArray(record.outcomes)
      .map(readOutcome)
      .filter((outcome): outcome is OddsApiOutcome => outcome !== null)
  };
}

function readOutcome(value: unknown): OddsApiOutcome | null {
  const record = readRecord(value);
  const name = readString(record.name);
  const price = readNumber(record.price);
  if (!name || !Number.isFinite(price) || price <= 1) return null;
  return { name, price };
}

export function parseLeagueOdds(league: LeagueSnapshot, events: OddsApiEvent[]): LeagueOdds {
  const bookmakerOddsByTeamId = new Map<number, BookmakerOdds[]>();
  const canonicalNameByTeamId = new Map(league.standings.map((team) => [team.teamId, team.teamName]));
  const bookmakerNames = new Set<string>();
  const unmatchedNames = new Set<string>();
  let matchedOutcomeCount = 0;
  let unmatchedOutcomeCount = 0;

  for (const event of events) {
    for (const bookmaker of event.bookmakers) {
      const market = bookmaker.markets.find((item) => item.key === ODDS_API_MARKET);
      if (!market) continue;

      const overround = market.outcomes.reduce((sum, outcome) => sum + oddsToProbability(outcome.price), 0);
      if (overround <= 0) continue;
      bookmakerNames.add(bookmaker.title);

      const mappedOutcomes = market.outcomes
        .map((outcome) => {
          const standing = matchStanding(outcome.name, league);
          if (standing) matchedOutcomeCount += 1;
          else {
            unmatchedOutcomeCount += 1;
            unmatchedNames.add(outcome.name);
          }
          return { outcome, standing };
        })
        .filter((item): item is { outcome: OddsApiOutcome; standing: LeagueSnapshot['standings'][number] } => item.standing !== null);

      if (mappedOutcomes.length < MIN_MAPPED_OUTCOMES) continue;

      for (const { outcome, standing } of mappedOutcomes) {
        const bookmakerOdds = bookmakerOddsByTeamId.get(standing.teamId) ?? [];
        bookmakerOdds.push({
          bookmaker: bookmaker.title,
          oddsDecimal: round(outcome.price),
          impliedProbability: round(oddsToProbability(outcome.price) / overround),
          lastUpdated: bookmaker.last_update
        });
        bookmakerOddsByTeamId.set(standing.teamId, bookmakerOdds);
      }
    }
  }

  const warnings = oddsWarnings(events, bookmakerNames.size, matchedOutcomeCount, unmatchedNames);
  if (warnings.length) {
    league.dataQuality.warnings.push(`Odds ${warnings.join(' | ')}`);
  }

  const teams: TeamOdds[] = Array.from(bookmakerOddsByTeamId.entries())
    .map(([teamId, bookmakerOdds]) => ({
      teamId,
      teamName: canonicalNameByTeamId.get(teamId) ?? String(teamId),
      bookmakerOdds,
      consensusProbability: round(bookmakerOdds.reduce((sum, odds) => sum + odds.impliedProbability, 0) / bookmakerOdds.length)
    }))
    .sort((a, b) => b.consensusProbability - a.consensusProbability);

  return {
    leagueId: league.id,
    fetchedAt: new Date().toISOString(),
    source: 'the-odds-api',
    teams,
    dataQuality: {
      bookmakerCount: bookmakerNames.size,
      matchedOutcomeCount,
      unmatchedOutcomeCount,
      coverageRatio: round(teams.length / Math.max(league.standings.length, 1)),
      warnings
    }
  };
}

function oddsWarnings(events: OddsApiEvent[], bookmakerCount: number, matchedOutcomeCount: number, unmatchedNames: Set<string>): string[] {
  const warnings: string[] = [];
  if (!events.length) warnings.push('API returned no outright events');
  else if (!bookmakerCount) warnings.push('No bookmakers returned an outrights market');
  else if (!matchedOutcomeCount) warnings.push('No odds outcomes matched standings teams');
  if (unmatchedNames.size) warnings.push(`Unmatched teams: ${Array.from(unmatchedNames).slice(0, 8).join(', ')}`);
  return warnings;
}

function matchStanding(outcomeName: string, league: LeagueSnapshot): LeagueSnapshot['standings'][number] | null {
  const normalizedOutcome = normalizeTeamName(outcomeName);
  return league.standings.find((standing) => {
    return normalizeTeamName(standing.teamName) === normalizedOutcome || normalizeTeamName(standing.shortName) === normalizedOutcome;
  }) ?? null;
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sc|afc|calcio|club|de|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function oddsToProbability(oddsDecimal: number): number {
  return oddsDecimal > 1 ? 1 / oddsDecimal : 0;
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
