import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chart } from '../components/Chart';
import type { ChartOption } from '../components/Chart';
import { Delta } from '../components/Delta';
import { ProbabilityBar } from '../components/ProbabilityBar';
import { TeamCrest } from '../components/TeamCrest';
import { formatPercent } from '../lib/format';
import type { LeagueSnapshot, Snapshot, TeamStanding, TitleProbability } from '../types';

export function LeaguePage({ snapshot }: { snapshot: Snapshot }) {
  const { leagueId } = useParams();
  const league = snapshot.leagues.find((item) => item.id === leagueId) ?? snapshot.leagues[0];
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const selectedTeam = useMemo(() => {
    if (!selectedTeamId) return null;
    return league.titleProbabilities.find((team) => team.teamId === selectedTeamId) ?? null;
  }, [league.titleProbabilities, selectedTeamId]);

  if (!league) {
    return <div className="rounded-[8px] border border-white/10 bg-white/5 p-4">没有可用联赛数据。</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[8px] border border-line/20 bg-pitch-900/75 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold text-emerald-50">{league.name}</h1>
            <p className="mt-2 text-sm text-emerald-50/58">
              {league.country} · {league.season} · {league.matches.length} matches tracked
            </p>
          </div>
          <div className="rounded-[6px] border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-emerald-50/58">
            Data quality: <span className="font-mono text-line">{league.dataQuality.status}</span>
          </div>
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

      <section className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4">
        <h2 className="mb-3 text-base font-semibold text-emerald-50">Top 5 概率分布</h2>
        <Chart option={probabilityChartOption(league)} className="min-h-[320px]" />
      </section>

      {selectedTeam ? <TeamDrawer team={selectedTeam} standing={league.standings.find((item) => item.teamId === selectedTeam.teamId)} onClose={() => setSelectedTeamId(null)} /> : null}
    </div>
  );
}

function StandingsTable({ league, onSelect }: { league: LeagueSnapshot; onSelect: (teamId: number) => void }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-white/10 bg-pitch-900/72">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="font-semibold text-emerald-50">积分榜</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[660px] text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase text-emerald-50/48">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-3 py-3">球队</th>
              <th className="px-3 py-3">赛</th>
              <th className="px-3 py-3">胜</th>
              <th className="px-3 py-3">平</th>
              <th className="px-3 py-3">负</th>
              <th className="px-3 py-3">净胜</th>
              <th className="px-3 py-3">积分</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.08]">
            {league.standings.map((team) => (
              <tr key={team.teamId} className="cursor-pointer hover:bg-line/[0.08]" onClick={() => onSelect(team.teamId)}>
                <td className="px-4 py-3 font-mono text-emerald-50/50">{team.position}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <TeamCrest name={team.teamName} crest={team.crest} size="sm" />
                    <span className="font-medium text-emerald-50">{team.shortName}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono">{team.playedGames}</td>
                <td className="px-3 py-3 font-mono">{team.won}</td>
                <td className="px-3 py-3 font-mono">{team.draw}</td>
                <td className="px-3 py-3 font-mono">{team.lost}</td>
                <td className="px-3 py-3 font-mono">{team.goalDifference}</td>
                <td className="px-3 py-3 font-mono text-line">{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProbabilityTable({ league, onSelect }: { league: LeagueSnapshot; onSelect: (teamId: number) => void }) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4">
      <h2 className="mb-4 font-semibold text-emerald-50">冠军概率榜</h2>
      <div className="space-y-4">
        {league.titleProbabilities.slice(0, 8).map((team, index) => (
          <button
            key={team.teamId}
            onClick={() => onSelect(team.teamId)}
            className="block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.035] p-3 text-left transition hover:border-line/30 hover:bg-line/[0.08]"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="w-6 font-mono text-xs text-emerald-50/42">{index + 1}</span>
              <TeamCrest name={team.teamName} crest={team.crest} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium text-emerald-50">{team.shortName}</span>
              <span className="font-mono text-line">{formatPercent(team.probability)}</span>
              <Delta value={team.probabilityDeltaPrevious} />
            </div>
            <ProbabilityBar value={team.probability} compact />
          </button>
        ))}
      </div>
    </div>
  );
}

function TeamDrawer({ team, standing, onClose }: { team: TitleProbability; standing?: TeamStanding; onClose: () => void }) {
  const features = Object.entries(team.features);
  return (
    <div className="fixed inset-0 z-40 bg-black/48 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ml-auto h-full w-full max-w-md overflow-y-auto border-l border-line/20 bg-pitch-950 p-5 shadow-glow"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <TeamCrest name={team.teamName} crest={team.crest} />
            <div>
              <h2 className="text-xl font-semibold text-emerald-50">{team.teamName}</h2>
              <p className="mt-1 font-mono text-line">{formatPercent(team.probability)} title probability</p>
            </div>
          </div>
          <button className="rounded-[6px] p-2 text-emerald-50/60 hover:bg-white/[0.08] hover:text-emerald-50" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        {standing ? (
          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              ['排名', standing.position],
              ['积分', standing.points],
              ['净胜球', standing.goalDifference],
              ['场次', standing.playedGames],
              ['进球', standing.goalsFor],
              ['失球', standing.goalsAgainst]
            ].map(([label, value]) => (
              <div key={label} className="rounded-[6px] border border-white/10 bg-white/[0.045] p-3">
                <p className="text-xs text-emerald-50/45">{label}</p>
                <p className="mt-1 font-mono text-lg text-emerald-50">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
          <h3 className="mb-3 font-semibold text-emerald-50">模型特征</h3>
          <div className="space-y-3">
            {features.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-emerald-50/58">{key}</span>
                <span className="font-mono text-emerald-50">{Number(value).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function probabilityChartOption(league: LeagueSnapshot): ChartOption {
  const teams = [...league.titleProbabilities.slice(0, 8)].reverse();
  return {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 92, right: 18, top: 20, bottom: 36 },
    xAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { formatter: (value: number) => `${value}%` }
    },
    yAxis: {
      type: 'category' as const,
      data: teams.map((team) => team.shortName)
    },
    dataZoom: [{ type: 'inside' as const }],
    series: [
      {
        name: '冠军概率',
        type: 'bar' as const,
        data: teams.map((team) => Math.round(team.probability * 1000) / 10),
        barWidth: 18,
        itemStyle: { borderRadius: [0, 4, 4, 0] }
      }
    ]
  };
}
