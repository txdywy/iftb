import { ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Chart } from '../components/Chart';
import type { ChartOption } from '../components/Chart';
import { Delta } from '../components/Delta';
import { LeagueEmblem } from '../components/LeagueEmblem';
import { ProbabilityBar } from '../components/ProbabilityBar';
import { TeamCrest } from '../components/TeamCrest';
import { formatPercent } from '../lib/format';
import { leagueLeaderTrend } from '../lib/history';
import type { Snapshot, TitleProbability } from '../types';

export function Dashboard({ snapshot, historySnapshots }: { snapshot: Snapshot; historySnapshots: Snapshot[] }) {
  const movers = snapshot.leagues
    .flatMap((league) =>
      league.titleProbabilities.slice(0, 8).map((team) => ({
        ...team,
        leagueName: league.name
      }))
    )
    .filter((team) => team.probabilityDeltaPrevious !== undefined)
    .sort((a, b) => Math.abs(b.probabilityDeltaPrevious ?? 0) - Math.abs(a.probabilityDeltaPrevious ?? 0))
    .slice(0, 8);

  const marketEdges = snapshot.leagues
    .flatMap((league) =>
      league.titleProbabilities.slice(0, 8).flatMap((team) => {
        const teamOdds = league.odds?.teams.find((item) => item.teamId === team.teamId);
        return teamOdds ? [{ ...team, leagueName: league.name, marketProbability: teamOdds.consensusProbability, edge: team.probability - teamOdds.consensusProbability }] : [];
      })
    )
    .sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))
    .slice(0, 8);

  const marketSchedules = snapshot.leagues
    .flatMap((league) => league.matchOdds?.teamSchedules.map((schedule) => ({ ...schedule, leagueName: league.name })) ?? [])
    .sort((a, b) => b.expectedPpg - a.expectedPpg)
    .slice(0, 8);

  const hasTrend = historySnapshots.length > 1;
  const option = hasTrend ? leaderTrendOption(historySnapshots) : leaderBarOption(snapshot);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[8px] border border-line/20 bg-pitch-900/78 p-5 shadow-glow">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line/70 to-transparent" />
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-emerald-50 sm:text-3xl">五大联赛争冠雷达</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/58">
              汇总五大联赛实时积分、赛程强度和近期走势，用同一套规则模型追踪冠军概率变化。
            </p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {snapshot.leagues.map((league) => (
              <LeagueEmblem key={league.id} league={league} size="sm" />
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-5">
        {snapshot.leagues.map((league) => (
          <LeagueCard key={league.id} league={league} />
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4 shadow-glow">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-emerald-50">{hasTrend ? '五大联赛榜首趋势' : '五大联赛榜首概率'}</h2>
              <p className="mt-1 text-xs text-emerald-50/45">
                {hasTrend ? `${historySnapshots.length} 个历史快照` : '历史快照不足，先显示当前分布'}
              </p>
            </div>
            <TrendingUp size={18} className="text-line" />
          </div>
          <Chart option={option} />
        </div>
        <div className="space-y-6">
          <div className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4">
            <h2 className="mb-4 text-base font-semibold text-emerald-50">最近变化榜</h2>
            <div className="space-y-3">
              {movers.length ? movers.map((team) => <MoverRow key={`${team.leagueName}-${team.teamId}`} team={team} />) : (
                <p className="text-sm text-emerald-50/55">暂无历史快照，下一次更新后显示变化。</p>
              )}
            </div>
          </div>
          <div className="rounded-[8px] border border-cyanline/20 bg-pitch-900/72 p-4">
            <h2 className="mb-4 text-base font-semibold text-emerald-50">市场分歧榜</h2>
            <div className="space-y-3">
              {marketEdges.length ? marketEdges.map((team) => <MarketEdgeRow key={`${team.leagueName}-${team.teamId}`} team={team} />) : (
                <p className="text-sm text-emerald-50/55">{marketEdgeEmptyText(snapshot)}</p>
              )}
            </div>
          </div>
          <div className="rounded-[8px] border border-cyanline/20 bg-pitch-900/72 p-4">
            <h2 className="mb-4 text-base font-semibold text-emerald-50">市场赛程榜</h2>
            <div className="space-y-3">
              {marketSchedules.length ? marketSchedules.map((schedule) => <MarketScheduleRow key={`${schedule.leagueName}-${schedule.teamId}`} schedule={schedule} />) : (
                <p className="text-sm text-emerald-50/55">暂无比赛赔率数据，下一次手动或定时刷新后显示市场预期赛程。</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function marketEdgeEmptyText(snapshot: Snapshot): string {
  const oddsWarnings = snapshot.leagues.flatMap((league) => {
    const structuredWarnings = league.odds?.dataQuality.warnings.map((warning) => `${league.name}: ${warning}`) ?? [];
    const fetchWarnings = league.dataQuality.warnings.filter((warning) => warning.startsWith('Odds ')).map((warning) => `${league.name}: ${warning}`);
    return [...structuredWarnings, ...fetchWarnings];
  });
  if (oddsWarnings.length) return oddsWarnings.slice(0, 2).join('；');
  if (snapshot.leagues.some((league) => league.odds)) return '赔率接口已返回，但暂无可匹配的争冠球队。';
  return '暂无赔率数据，配置 ODDS_API_KEY 后显示市场分歧。';
}

function leaderBarOption(snapshot: Snapshot): ChartOption {
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { top: 0, textStyle: { color: '#b8d5ca' } },
    grid: { left: 34, right: 12, top: 48, bottom: 32 },
    xAxis: {
      type: 'category' as const,
      data: snapshot.leagues.map((league) => league.name)
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { formatter: (value: number) => `${value}%` },
      max: 100
    },
    series: [
      {
        name: '榜首概率',
        type: 'bar' as const,
        data: snapshot.leagues.map((league) => Math.round((league.topContenders[0]?.probability ?? 0) * 1000) / 10),
        barWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0] }
      }
    ]
  };
}

function leaderTrendOption(historySnapshots: Snapshot[]): ChartOption {
  const trend = leagueLeaderTrend(historySnapshots);
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { top: 0, textStyle: { color: '#b8d5ca' } },
    grid: { left: 38, right: 18, top: 56, bottom: 48 },
    dataZoom: [{ type: 'inside' as const }, { type: 'slider' as const, height: 18, bottom: 8 }],
    xAxis: {
      type: 'category' as const,
      data: trend.labels,
      boundaryGap: false
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { formatter: (value: number) => `${value}%` },
      max: 100
    },
    series: trend.series.map((item) => ({
      name: item.name,
      type: 'line' as const,
      data: item.values,
      smooth: true,
      symbolSize: 5,
      connectNulls: true
    }))
  };
}

function LeagueCard({ league }: { league: Snapshot['leagues'][number] }) {
  const leader = league.topContenders[0];
  const leaderOdds = leader ? league.odds?.teams.find((team) => team.teamId === leader.teamId) : undefined;
  return (
    <Link
      to={`/leagues/${league.id}`}
      className="group relative overflow-hidden rounded-[8px] border border-white/10 bg-pitch-900/78 p-4 transition hover:border-line/35 hover:bg-pitch-850/86"
    >
      <div className="absolute -right-5 -top-5 opacity-10 transition group-hover:opacity-20">
        <LeagueEmblem league={league} size="lg" muted />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <LeagueEmblem league={league} size="sm" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-emerald-50">{league.name}</h2>
            <p className="mt-1 truncate text-xs text-emerald-50/50">{league.country} · {league.season}</p>
          </div>
        </div>
        <ArrowRight size={17} className="text-emerald-50/35 transition group-hover:translate-x-1 group-hover:text-line" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 border-y border-white/10 py-3 text-xs">
        <div>
          <p className="text-emerald-50/42">争冠队</p>
          <p className="mt-1 font-mono text-emerald-50">{league.topContenders.length}</p>
        </div>
        <div>
          <p className="text-emerald-50/42">场次</p>
          <p className="mt-1 font-mono text-emerald-50">{league.matches.length}</p>
        </div>
      </div>
      {leader ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <TeamCrest name={leader.teamName} crest={leader.crest} />
            <div className="min-w-0">
              <p className="truncate font-medium text-emerald-50">{leader.shortName}</p>
              <p className="font-mono text-2xl font-semibold text-line">{formatPercent(leader.probability)}</p>
              {leaderOdds ? (
                <p className="mt-1 text-xs text-emerald-50/48">
                  赔率共识 <span className="font-mono text-cyanline">{formatPercent(leaderOdds.consensusProbability)}</span>
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            {league.topContenders.slice(0, 5).map((team) => (
              <ProbabilityBar key={team.teamId} label={team.shortName} value={team.probability} compact />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-emerald-50/55">暂无争冠数据</p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-emerald-50/50">
        <span>{league.dataQuality.status}</span>
        <span>{league.standings.length} teams</span>
      </div>
    </Link>
  );
}

function MarketEdgeRow({ team }: { team: TitleProbability & { leagueName: string; marketProbability: number; edge: number } }) {
  return (
    <div className="flex items-center gap-3 rounded-[6px] bg-white/[0.04] p-2.5">
      <TeamCrest name={team.teamName} crest={team.crest} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-emerald-50">{team.shortName}</p>
        <p className="text-xs text-emerald-50/45">{team.leagueName} · {team.edge >= 0 ? '模型更看好' : '市场更看好'}</p>
      </div>
      <div className="text-right">
        <p className={`font-mono text-xs ${team.edge >= 0 ? 'text-line' : 'text-danger'}`}>{formatPercent(team.edge)}</p>
        <p className="font-mono text-[11px] text-cyanline">赔率 {formatPercent(team.marketProbability)}</p>
      </div>
    </div>
  );
}

function MarketScheduleRow({ schedule }: { schedule: { teamId: number; teamName: string; leagueName: string; matches: number; expectedPoints: number; expectedPpg: number } }) {
  return (
    <div className="rounded-[6px] bg-white/[0.04] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-emerald-50">{schedule.teamName}</p>
          <p className="text-xs text-emerald-50/45">{schedule.leagueName} · {schedule.matches} 场</p>
        </div>
        <p className="font-mono text-xs text-line">{schedule.expectedPpg.toFixed(2)} PPG</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-cyanline" style={{ width: `${Math.min(100, (schedule.expectedPpg / 3) * 100)}%` }} />
      </div>
      <p className="mt-1 font-mono text-[11px] text-cyanline">预期积分 {schedule.expectedPoints.toFixed(1)}</p>
    </div>
  );
}

function MoverRow({ team }: { team: TitleProbability & { leagueName: string } }) {
  return (
    <div className="flex items-center gap-3 rounded-[6px] bg-white/[0.04] p-2.5">
      <TeamCrest name={team.teamName} crest={team.crest} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-emerald-50">{team.shortName}</p>
        <p className="text-xs text-emerald-50/45">{team.leagueName}</p>
      </div>
      <Delta value={team.probabilityDeltaPrevious} />
    </div>
  );
}
