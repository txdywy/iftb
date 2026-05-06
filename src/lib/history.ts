import type { LeagueId, Snapshot } from '../types';

export interface TrendSeries {
  name: string;
  values: Array<number | null>;
}

export interface LeagueTrend {
  labels: string[];
  series: TrendSeries[];
}

export function formatSnapshotLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate));
}

export function leagueLeaderTrend(history: Snapshot[]): LeagueTrend {
  const labels = history.map((snapshot) => formatSnapshotLabel(snapshot.generatedAt));
  const leagueIds = history.at(-1)?.leagues.map((league) => league.id) ?? [];
  const series = leagueIds.map((leagueId) => {
    const currentLeague = history.at(-1)?.leagues.find((league) => league.id === leagueId);
    const leader = currentLeague?.topContenders[0];
    return {
      name: currentLeague?.name ?? leagueId,
      values: history.map((snapshot) => {
        const league = snapshot.leagues.find((item) => item.id === leagueId);
        if (!leader) return null;
        const team = league?.titleProbabilities.find((item) => item.teamId === leader.teamId);
        return team ? Math.round(team.probability * 1000) / 10 : null;
      })
    };
  });
  return { labels, series };
}

export function contendersTrend(history: Snapshot[], leagueId: LeagueId, teamIds: number[]): LeagueTrend {
  const labels = history.map((snapshot) => formatSnapshotLabel(snapshot.generatedAt));
  const currentLeague = history.at(-1)?.leagues.find((league) => league.id === leagueId);
  const series = teamIds.map((teamId) => {
    const currentTeam = currentLeague?.titleProbabilities.find((team) => team.teamId === teamId);
    return {
      name: currentTeam?.shortName ?? String(teamId),
      values: history.map((snapshot) => {
        const league = snapshot.leagues.find((item) => item.id === leagueId);
        const team = league?.titleProbabilities.find((item) => item.teamId === teamId);
        return team ? Math.round(team.probability * 1000) / 10 : null;
      })
    };
  });
  return { labels, series };
}
