import { ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Chart } from '../components/Chart';
import type { ChartOption } from '../components/Chart';
import { Delta } from '../components/Delta';
import { ProbabilityBar } from '../components/ProbabilityBar';
import { TeamCrest } from '../components/TeamCrest';
import { formatPercent } from '../lib/format';
import type { Snapshot, TitleProbability } from '../types';

export function Dashboard({ snapshot }: { snapshot: Snapshot }) {
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

  const option: ChartOption = {
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

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-5">
        {snapshot.leagues.map((league) => (
          <LeagueCard key={league.id} league={league} />
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4 shadow-glow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-emerald-50">五大联赛榜首概率</h2>
            <TrendingUp size={18} className="text-line" />
          </div>
          <Chart option={option} />
        </div>
        <div className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4">
          <h2 className="mb-4 text-base font-semibold text-emerald-50">最近变化榜</h2>
          <div className="space-y-3">
            {movers.length ? movers.map((team) => <MoverRow key={`${team.leagueName}-${team.teamId}`} team={team} />) : (
              <p className="text-sm text-emerald-50/55">暂无历史快照，下一次更新后显示变化。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function LeagueCard({ league }: { league: Snapshot['leagues'][number] }) {
  const leader = league.topContenders[0];
  return (
    <Link
      to={`/leagues/${league.id}`}
      className="group rounded-[8px] border border-white/10 bg-pitch-900/78 p-4 transition hover:border-line/35 hover:bg-pitch-850/86"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-emerald-50">{league.name}</h2>
          <p className="mt-1 text-xs text-emerald-50/50">{league.country} · {league.season}</p>
        </div>
        <ArrowRight size={17} className="text-emerald-50/35 transition group-hover:translate-x-1 group-hover:text-line" />
      </div>
      {leader ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <TeamCrest name={leader.teamName} crest={leader.crest} />
            <div className="min-w-0">
              <p className="truncate font-medium text-emerald-50">{leader.shortName}</p>
              <p className="font-mono text-2xl font-semibold text-line">{formatPercent(leader.probability)}</p>
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
