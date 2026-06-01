import type { LeagueId, Snapshot, TitleProbability } from '../types';

export interface TrendSeries {
  name: string;
  values: Array<number | null>;
}

export interface LeagueTrend {
  labels: string[];
  series: TrendSeries[];
}

const labelFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

export function formatSnapshotLabel(isoDate: string): string {
  return labelFormatter.format(new Date(isoDate));
}

function toPercent(probability: number): number {
  return Math.round(probability * 1000) / 10;
}

// Build, for one league across all snapshots, a per-snapshot map of
// teamId -> probability so series extraction is O(1) per point instead of a
// nested find over leagues and teams.
function probabilityLookups(history: Snapshot[], leagueId: LeagueId): Array<Map<number, number>> {
  return history.map((snapshot) => {
    const league = snapshot.leagues.find((item) => item.id === leagueId);
    const lookup = new Map<number, number>();
    for (const team of league?.titleProbabilities ?? []) {
      lookup.set(team.teamId, team.probability);
    }
    return lookup;
  });
}

function seriesFor(lookups: Array<Map<number, number>>, teamId: number): Array<number | null> {
  return lookups.map((lookup) => {
    const probability = lookup.get(teamId);
    return probability === undefined ? null : toPercent(probability);
  });
}

export function leagueLeaderTrend(history: Snapshot[]): LeagueTrend {
  const labels = history.map((snapshot) => formatSnapshotLabel(snapshot.generatedAt));
  const current = history.at(-1);
  const series = (current?.leagues ?? []).map((league) => {
    const leader: TitleProbability | undefined = league.topContenders[0];
    const lookups = probabilityLookups(history, league.id);
    return {
      name: league.name,
      values: leader ? seriesFor(lookups, leader.teamId) : labels.map(() => null)
    };
  });
  return { labels, series };
}

export function contendersTrend(history: Snapshot[], leagueId: LeagueId, teamIds: number[]): LeagueTrend {
  const labels = history.map((snapshot) => formatSnapshotLabel(snapshot.generatedAt));
  const current = history.at(-1)?.leagues.find((league) => league.id === leagueId);
  const nameByTeamId = new Map((current?.titleProbabilities ?? []).map((team) => [team.teamId, team.shortName]));
  const lookups = probabilityLookups(history, leagueId);
  const series = teamIds.map((teamId) => ({
    name: nameByTeamId.get(teamId) ?? String(teamId),
    values: seriesFor(lookups, teamId)
  }));
  return { labels, series };
}
