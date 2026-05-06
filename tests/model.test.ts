import { describe, expect, it } from 'vitest';
import { LEAGUES } from '../src/data/leagues';
import type { LeagueSnapshot, TeamStanding } from '../src/types';
import { calculateLeagueProbabilities, calculateSnapshotProbabilities } from '../scripts/calculate-title-probability';
import { adaptMatches, adaptStandings } from '../scripts/fetch-football-data';
import { sampleSnapshot } from '../scripts/shared';
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
