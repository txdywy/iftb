import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chart } from '../components/Chart';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LeagueEmblem } from '../components/LeagueEmblem';
import { formatPercent } from '../lib/format';
import {
  MarketEdgePanel,
  MarketSchedulePanel,
  Metric,
  ProbabilityTable,
  StandingsTable,
  TeamDrawer
} from './league/components';
import { probabilityChartOption, probabilityTrendOption } from './league/chartOptions';
import type { Snapshot } from '../types';

export function LeaguePage({ snapshot, historySnapshots }: { snapshot: Snapshot; historySnapshots: Snapshot[] }) {
  const { leagueId } = useParams();
  const league = useMemo(
    () => snapshot.leagues.find((item) => item.id === leagueId) ?? snapshot.leagues[0],
    [snapshot.leagues, leagueId]
  );
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const selectedTeam = useMemo(() => {
    if (selectedTeamId === null) return null;
    return league?.titleProbabilities.find((team) => team.teamId === selectedTeamId) ?? null;
  }, [league?.titleProbabilities, selectedTeamId]);

  const hasTrend = historySnapshots.length > 1;
  const chartOption = useMemo(
    () => (hasTrend && league ? probabilityTrendOption(league, historySnapshots) : league ? probabilityChartOption(league) : null),
    [hasTrend, league, historySnapshots]
  );

  if (!league) {
    return <div className="rounded-[8px] border border-white/10 bg-white/5 p-4">没有可用联赛数据。</div>;
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[8px] border border-line/20 bg-pitch-900/75 p-5 shadow-glow">
        <div className="absolute -right-8 -top-10 opacity-10">
          <LeagueEmblem league={league} size="lg" muted />
        </div>
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex items-center gap-4">
            <LeagueEmblem league={league} size="lg" />
            <div>
              <h1 className="text-3xl font-semibold text-emerald-50">{league.name}</h1>
              <p className="mt-2 text-sm text-emerald-50/58">
                {league.country} · {league.season} · {league.matches.length} matches tracked
              </p>
            </div>
          </div>
          <div className="rounded-[6px] border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-emerald-50/58">
            Data quality: <span className="font-mono text-line">{league.dataQuality.status}</span>
          </div>
        </div>
        <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
          <Metric label="榜首概率" value={league.topContenders[0] ? formatPercent(league.topContenders[0].probability) : '—'} />
          <Metric label="争冠梯队" value={`${league.topContenders.length}`} />
          <Metric label="积分榜球队" value={`${league.standings.length}`} />
        </div>
        {league.dataQuality.warnings.length ? (
          <div className="mt-4 rounded-[6px] border border-warning/25 bg-warning/10 p-3 text-sm text-yellow-100">
            {league.dataQuality.warnings.join(' · ')}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <StandingsTable league={league} onSelect={setSelectedTeamId} />
        <ProbabilityTable league={league} onSelect={setSelectedTeamId} />
      </section>

      {league.odds ? <MarketEdgePanel league={league} onSelect={setSelectedTeamId} /> : null}
      {league.matchOdds ? <MarketSchedulePanel league={league} onSelect={setSelectedTeamId} /> : null}

      <section className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-emerald-50">{hasTrend ? 'Top 5 概率趋势' : 'Top 5 概率分布'}</h2>
          <p className="mt-1 text-xs text-emerald-50/45">
            {hasTrend ? `${historySnapshots.length} 个快照，默认追踪当前 Top 5` : '历史快照不足，先显示当前概率条形图'}
          </p>
        </div>
        {chartOption ? (
          <ErrorBoundary><Chart option={chartOption} className="min-h-[320px]" /></ErrorBoundary>
        ) : null}
      </section>

      {selectedTeam ? (
        <TeamDrawer
          team={selectedTeam}
          teamOdds={league.odds?.teams.find((item) => item.teamId === selectedTeam.teamId)}
          matchOdds={league.matchOdds}
          standing={league.standings.find((item) => item.teamId === selectedTeam.teamId)}
          onClose={() => setSelectedTeamId(null)}
        />
      ) : null}
    </div>
  );
}
