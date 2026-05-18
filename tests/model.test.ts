import { describe, expect, it } from 'vitest';
import { LEAGUES } from '../src/data/leagues';
import type { LeagueSnapshot, TeamStanding } from '../src/types';
import { calculateLeagueProbabilities, calculateSnapshotProbabilities } from '../scripts/calculate-title-probability';
import { adaptMatches, adaptStandings } from '../scripts/fetch-football-data';
import { parseLeagueOdds } from '../scripts/fetch-odds-data';
import { parseLeagueMatchOdds } from '../scripts/fetch-match-odds-data';
import { normalizeOddsTeamName, sampleSnapshot } from '../scripts/shared';
import { validateSnapshot } from '../scripts/validate-data';
import { contendersTrend, leagueLeaderTrend } from '../src/lib/history';

describe('league mapping', () => {
  it('maps the five target leagues to football-data codes', () => {
    expect(LEAGUES.map((league) => [league.id, league.code])).toEqual([
      ['epl', 'PL'],
      ['laliga', 'PD'],
      ['bundesliga', 'BL1'],
      ['seriea', 'SA'],
      ['ligue1', 'FL1']
    ]);
  });
});

describe('history trend helpers', () => {
  it('builds league leader and contender trend series from snapshots', () => {
    const first = calculateSnapshotProbabilities(sampleSnapshot(new Date('2026-05-06T00:00:00Z')));
    const secondBase = sampleSnapshot(new Date('2026-05-07T00:00:00Z'));
    secondBase.leagues[0].standings[0].points += 3;
    const second = calculateSnapshotProbabilities(secondBase, [first]);
    const leaderTrend = leagueLeaderTrend([first, second]);
    expect(leaderTrend.labels).toHaveLength(2);
    expect(leaderTrend.series).toHaveLength(5);
    expect(leaderTrend.series[0].values).toHaveLength(2);

    const teamIds = second.leagues[0].titleProbabilities.slice(0, 2).map((team) => team.teamId);
    const trend = contendersTrend([first, second], 'epl', teamIds);
    expect(trend.series).toHaveLength(2);
    expect(trend.series[0].values.every((value) => value === null || Number.isFinite(value))).toBe(true);
  });
});

describe('odds integration', () => {
  it('normalizes bookmaker odds against the full market overround', () => {
    const league = makeLeague([
      team(1, 'Arsenal', 1, 10, 25, 15),
      team(2, 'Liverpool', 2, 10, 24, 12),
      team(3, 'Manchester City', 3, 10, 23, 10),
      team(4, 'Chelsea', 4, 10, 18, 4)
    ]);
    const odds = parseLeagueOdds(league, [
      {
        bookmakers: [
          {
            key: 'book',
            title: 'Book',
            last_update: '2026-05-07T00:00:00Z',
            markets: [
              {
                key: 'outrights',
                outcomes: [
                  { name: 'Arsenal', price: 2 },
                  { name: 'Liverpool', price: 4 },
                  { name: 'Manchester City', price: 5 },
                  { name: 'Unmapped FC', price: 10 }
                ]
              }
            ]
          }
        ]
      }
    ]);

    league.odds = odds;
    expect(odds.teams.find((item) => item.teamId === 1)?.consensusProbability).toBeCloseTo(0.4762, 4);
    expect(odds.dataQuality).toMatchObject({
      bookmakerCount: 1,
      matchedOutcomeCount: 3,
      unmatchedOutcomeCount: 1,
      coverageRatio: 0.75
    });
    expect(league.dataQuality.warnings.some((warning) => warning.includes('Unmapped FC'))).toBe(true);
    expect(validateSnapshot({ generatedAt: '2026-05-07T00:00:00Z', modelVersion: 'test', leagues: [league, league, league, league, { ...league, id: 'laliga' }] })).toContain('laliga: odds leagueId must match league id');
  });
});

describe('match odds integration', () => {
  it('normalizes common bookmaker team aliases', () => {
    expect(normalizeOddsTeamName('Brighton and Hove Albion')).toBe(normalizeOddsTeamName('Brighton & Hove Albion FC'));
    expect(normalizeOddsTeamName('Bayer Leverkusen')).toBe(normalizeOddsTeamName('Bayer 04 Leverkusen'));
    expect(normalizeOddsTeamName('TSG Hoffenheim')).toBe(normalizeOddsTeamName('TSG 1899 Hoffenheim'));
    expect(normalizeOddsTeamName('1. FC Heidenheim')).toBe(normalizeOddsTeamName('1. FC Heidenheim 1846'));
    expect(normalizeOddsTeamName('Werder Bremen')).toBe(normalizeOddsTeamName('SV Werder Bremen'));
    expect(normalizeOddsTeamName('Inter Milan')).toBe(normalizeOddsTeamName('FC Internazionale Milano'));
    expect(normalizeOddsTeamName('Lyon')).toBe(normalizeOddsTeamName('Olympique Lyonnais'));
  });

  it('converts h2h odds to market expected points', () => {
    const league = makeLeague([
      team(1, 'Arsenal', 1, 10, 25, 15),
      team(2, 'Liverpool', 2, 10, 24, 12)
    ]);
    league.matches = [match(10, 1, 2)];

    const matchOdds = parseLeagueMatchOdds(league, [
      {
        commence_time: '2026-05-10T12:00:00Z',
        home_team: 'Arsenal',
        away_team: 'Liverpool',
        bookmakers: [
          {
            title: 'Book',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Arsenal', price: 2 },
                  { name: 'Draw', price: 4 },
                  { name: 'Liverpool', price: 4 }
                ]
              }
            ]
          }
        ]
      }
    ]);

    league.matchOdds = matchOdds;
    expect(matchOdds.matches[0].matchId).toBe(10);
    expect(matchOdds.teamSchedules.find((item) => item.teamId === 1)?.expectedPoints).toBeCloseTo(1.75, 2);
    expect(matchOdds.teamSchedules.find((item) => item.teamId === 2)?.expectedPoints).toBeCloseTo(1, 2);
    expect(validateSnapshot({ generatedAt: '2026-05-07T00:00:00Z', modelVersion: 'test', leagues: [league, league, league, league, league] })).toEqual([]);
  });

  it('ignores match odds events that do not belong to current fixtures', () => {
    const league = makeLeague([
      team(1, 'Arsenal', 1, 10, 25, 15),
      team(2, 'Liverpool', 2, 10, 24, 12)
    ]);
    league.matches = [match(10, 1, 2)];

    const matchOdds = parseLeagueMatchOdds(league, [
      matchOddsEvent('2026-05-10T12:00:00Z'),
      matchOddsEvent('2026-08-10T12:00:00Z')
    ]);

    league.matchOdds = matchOdds;
    expect(matchOdds.matches).toHaveLength(1);
    expect(matchOdds.dataQuality.coverageRatio).toBe(1);
    expect(matchOdds.teamSchedules.find((item) => item.teamId === 1)?.matches).toBe(1);
    expect(validateSnapshot({ generatedAt: '2026-05-07T00:00:00Z', modelVersion: 'test', leagues: [league, league, league, league, league] })).toEqual([]);
  });
});

describe('football-data adapters', () => {
  it('converts standings and matches to internal schema', () => {
    const standings = adaptStandings({
      standings: [
        {
          type: 'TOTAL',
          table: [
            {
              position: 1,
              team: { id: 1, name: 'Team A', shortName: 'A', crest: 'crest.svg' },
              playedGames: 10,
              form: 'WWDWL',
              won: 7,
              draw: 2,
              lost: 1,
              points: 23,
              goalsFor: 24,
              goalsAgainst: 9,
              goalDifference: 15
            }
          ]
        }
      ]
    });
    const matches = adaptMatches({
      matches: [
        {
          id: 99,
          utcDate: '2026-05-01T12:00:00Z',
          status: 'SCHEDULED',
          matchday: 35,
          homeTeam: { id: 1, name: 'Team A' },
          awayTeam: { id: 2, name: 'Team B' },
          score: { fullTime: { home: null, away: null } }
        }
      ]
    });
    expect(standings[0]).toMatchObject({ teamId: 1, shortName: 'A', points: 23 });
    expect(matches[0]).toMatchObject({ id: 99, homeTeamId: 1, awayTeamId: 2 });
  });
});

describe('title probability model', () => {
  it('produces probabilities that sum to one and validate', () => {
    const snapshot = calculateSnapshotProbabilities(sampleSnapshot(new Date('2026-05-06T00:00:00Z')));
    for (const league of snapshot.leagues) {
      expect(league.titleProbabilities.reduce((sum, team) => sum + team.probability, 0)).toBeCloseTo(1, 3);
    }
    expect(validateSnapshot(snapshot)).toEqual([]);
  });

  it('rewards points and goal difference advantages', () => {
    const league = calculateLeagueProbabilities(makeLeague([
      team(1, 'Leader', 1, 34, 80, 48),
      team(2, 'Chaser', 2, 34, 74, 30),
      team(3, 'Outsider', 3, 34, 65, 18)
    ]));
    expect(league.titleProbabilities[0].teamName).toBe('Leader');
    expect(league.titleProbabilities[0].probability).toBeGreaterThan(league.titleProbabilities[1].probability);
  });

  it('reduces probability when remaining schedule is harder', () => {
    const base = makeLeague([
      team(1, 'Easy Run', 1, 30, 70, 30),
      team(2, 'Hard Run', 2, 30, 70, 30),
      team(3, 'Strong Opponent', 3, 30, 69, 24),
      team(4, 'Weak Opponent', 4, 30, 20, -35)
    ]);
    base.matches = [
      match(1, 1, 4),
      match(2, 2, 3)
    ];
    const league = calculateLeagueProbabilities(base);
    const easy = league.titleProbabilities.find((item) => item.teamId === 1)!;
    const hard = league.titleProbabilities.find((item) => item.teamId === 2)!;
    expect(easy.probability).toBeGreaterThan(hard.probability);
  });

  it('sets mathematically eliminated teams to zero', () => {
    const league = calculateLeagueProbabilities(makeLeague([
      team(1, 'Leader', 1, 34, 82, 40),
      team(2, 'Eliminated', 2, 34, 60, 25)
    ]));
    expect(league.titleProbabilities.find((item) => item.teamId === 2)?.probability).toBe(0);
  });

  it('locks champion when season is finished', () => {
    const league = makeLeague([
      team(1, 'A', 1, 38, 84, 36, 80),
      team(2, 'B', 2, 38, 84, 32, 82)
    ]);
    league.matches = league.matches.map((item) => ({ ...item, status: 'FINISHED' }));
    const calculated = calculateLeagueProbabilities(league);
    expect(calculated.titleProbabilities.find((item) => item.teamId === 1)?.probability).toBe(1);
    expect(calculated.titleProbabilities.find((item) => item.teamId === 2)?.probability).toBe(0);
  });
});

function makeLeague(standings: TeamStanding[]): LeagueSnapshot {
  return {
    id: 'epl',
    name: '英超',
    country: 'England',
    code: 'PL',
    emblem: 'assets/leagues/epl.svg',
    season: '2025-2026',
    standings,
    matches: standings.slice(0, -1).map((standing, index) => match(index + 1, standing.teamId, standings[index + 1].teamId)),
    titleProbabilities: [],
    topContenders: [],
    dataQuality: { status: 'ok', warnings: [] }
  };
}

function team(teamId: number, teamName: string, position: number, playedGames: number, points: number, goalDifference: number, goalsFor = 70): TeamStanding {
  return {
    teamId,
    teamName,
    shortName: teamName,
    position,
    playedGames,
    won: Math.floor(points / 3),
    draw: points % 3,
    lost: Math.max(0, playedGames - Math.floor(points / 3) - (points % 3)),
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    goalDifference,
    points,
    form: 'WWDWW'
  };
}

function match(id: number, homeTeamId: number, awayTeamId: number) {
  return {
    id,
    utcDate: '2026-05-10T12:00:00Z',
    status: 'SCHEDULED',
    matchday: 35,
    homeTeamId,
    homeTeamName: `Home ${homeTeamId}`,
    awayTeamId,
    awayTeamName: `Away ${awayTeamId}`,
    homeScore: null,
    awayScore: null
  };
}

function matchOddsEvent(commenceTime: string) {
  return {
    commence_time: commenceTime,
    home_team: 'Arsenal',
    away_team: 'Liverpool',
    bookmakers: [
      {
        title: 'Book',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Arsenal', price: 2 },
              { name: 'Draw', price: 4 },
              { name: 'Liverpool', price: 4 }
            ]
          }
        ]
      }
    ]
  };
}
