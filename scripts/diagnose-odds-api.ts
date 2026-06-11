import { ODDS_API_SPORT_KEYS, readString, readBoolean } from './shared';

const SPORTS_URL = 'https://api.the-odds-api.com/v4/sports/';

interface SportEntry {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

async function main() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error('ODDS_API_KEY is required');

  const url = new URL(SPORTS_URL);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('all', 'true');

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`The Odds API sports catalog returned ${response.status}`);

  const sports = parseSports(await response.json());
  const configuredKeys = new Set(Object.values(ODDS_API_SPORT_KEYS));
  const soccerSports = sports.filter((sport) => sport.key.startsWith('soccer_'));
  const winnerCandidates = soccerSports.filter((sport) => /winner|outright|league|epl|liga|bundesliga|serie|ligue/i.test(`${sport.key} ${sport.title} ${sport.description}`));

  console.log('Configured sport keys:');
  for (const sportKey of configuredKeys) {
    const sport = sports.find((item) => item.key === sportKey);
    console.log(formatSportStatus(sportKey, sport));
  }

  console.log('\nSoccer outright/winner candidates:');
  for (const sport of winnerCandidates) {
    console.log(`- ${sport.key} | ${sport.title} | active=${sport.active} | has_outrights=${sport.has_outrights}`);
  }

  if (!winnerCandidates.some((sport) => sport.has_outrights)) {
    console.log('\nNo soccer winner/outright candidates with has_outrights=true were found in this catalog response.');
  }
}

function formatSportStatus(sportKey: string, sport: SportEntry | undefined): string {
  if (!sport) return `- ${sportKey}: not found in sports catalog`;
  return `- ${sport.key}: ${sport.title} | active=${sport.active} | has_outrights=${sport.has_outrights}`;
}

function parseSports(value: unknown): SportEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(readSport).filter((sport): sport is SportEntry => sport !== null);
}

function readSport(value: unknown): SportEntry | null {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const key = readString(record.key);
  if (!key) return null;
  return {
    key,
    group: readString(record.group),
    title: readString(record.title),
    description: readString(record.description),
    active: readBoolean(record.active),
    has_outrights: readBoolean(record.has_outrights)
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
