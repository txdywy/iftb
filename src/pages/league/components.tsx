import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { Delta } from '../../components/Delta';
import { ProbabilityBar } from '../../components/ProbabilityBar';
import { TeamCrest } from '../../components/TeamCrest';
import { formatPercent } from '../../lib/format';
import { expectedPointsForTeam } from '../../lib/odds';
import type { LeagueMatchOdds, LeagueSnapshot, MatchOdds, ProbabilityFeatures, TeamOdds, TeamStanding, TitleProbability } from '../../types';

// ---------------------------------------------------------------------------
// Metric
// ---------------------------------------------------------------------------
export const Metric = React.memo(function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-emerald-50/45">{label}</p>
      <p className="mt-1 font-mono text-lg text-line">{value}</p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// StandingsTable
// ---------------------------------------------------------------------------
export const StandingsTable = React.memo(function StandingsTable({ league, onSelect }: { league: LeagueSnapshot; onSelect: (teamId: number) => void }) {
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
});

// ---------------------------------------------------------------------------
// OddsMetric (shared helper)
// ---------------------------------------------------------------------------
export const OddsMetric = React.memo(function OddsMetric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-emerald-50/42">{label}</p>
      <p className={`mt-1 font-mono ${accent}`}>{value}</p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// MarketEdgePanel
// ---------------------------------------------------------------------------
export const MarketEdgePanel = React.memo(function MarketEdgePanel({ league, onSelect }: { league: LeagueSnapshot; onSelect: (teamId: number) => void }) {
  const edges = league.titleProbabilities
    .map((team) => {
      const teamOdds = league.odds?.teams.find((item) => item.teamId === team.teamId);
      return teamOdds ? { team, teamOdds, edge: team.probability - teamOdds.consensusProbability } : null;
    })
    .filter((item): item is { team: TitleProbability; teamOdds: TeamOdds; edge: number } => item !== null)
    .sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))
    .slice(0, 6);

  if (!edges.length) {
    const warning = league.odds?.dataQuality.warnings[0] ?? '赔率接口已返回，但暂无可匹配的争冠球队。';
    return (
      <section className="rounded-[8px] border border-cyanline/20 bg-pitch-900/72 p-4">
        <h2 className="text-base font-semibold text-emerald-50">模型与市场分歧</h2>
        <p className="mt-2 text-sm text-emerald-50/55">{warning}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] border border-cyanline/20 bg-pitch-900/72 p-4">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-semibold text-emerald-50">模型与市场分歧</h2>
          <p className="mt-1 text-xs text-emerald-50/45">
            覆盖率 {formatPercent(league.odds?.dataQuality.coverageRatio ?? 0)} · {league.odds?.dataQuality.bookmakerCount ?? 0} 家机构
          </p>
        </div>
        <p className="text-xs text-emerald-50/45">正值表示模型更看好，负值表示市场更看好。</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {edges.map(({ team, teamOdds, edge }) => (
          <button
            key={team.teamId}
            onClick={() => onSelect(team.teamId)}
            className="rounded-[6px] border border-white/[0.08] bg-white/[0.035] p-3 text-left transition hover:border-cyanline/35 hover:bg-cyanline/[0.08]"
          >
            <div className="mb-3 flex items-center gap-3">
              <TeamCrest name={team.teamName} crest={team.crest} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-emerald-50">{team.shortName}</p>
                <p className="text-xs text-emerald-50/45">{edge >= 0 ? '模型更看好' : '市场更看好'}</p>
              </div>
              <span className={`font-mono text-sm ${edge >= 0 ? 'text-line' : 'text-danger'}`}>{formatPercent(edge)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <OddsMetric label="模型" value={formatPercent(team.probability)} accent="text-line" />
              <OddsMetric label="赔率" value={formatPercent(teamOdds.consensusProbability)} accent="text-cyanline" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
});

// ---------------------------------------------------------------------------
// MarketSchedulePanel
// ---------------------------------------------------------------------------
export const MarketSchedulePanel = React.memo(function MarketSchedulePanel({ league, onSelect }: { league: LeagueSnapshot; onSelect: (teamId: number) => void }) {
  const schedules = league.matchOdds?.teamSchedules.slice(0, 8) ?? [];
  if (!schedules.length) {
    const warning = league.matchOdds?.dataQuality.warnings[0] ?? '暂无可匹配的比赛赔率。';
    return (
      <section className="rounded-[8px] border border-cyanline/20 bg-pitch-900/72 p-4">
        <h2 className="text-base font-semibold text-emerald-50">市场预期赛程</h2>
        <p className="mt-2 text-sm text-emerald-50/55">{warning}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] border border-cyanline/20 bg-pitch-900/72 p-4">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-semibold text-emerald-50">市场预期赛程</h2>
          <p className="mt-1 text-xs text-emerald-50/45">
            覆盖率 {formatPercent(league.matchOdds?.dataQuality.coverageRatio ?? 0)} · {league.matchOdds?.dataQuality.bookmakerCount ?? 0} 个机构盘口
          </p>
        </div>
        <p className="text-xs text-emerald-50/45">基于未来比赛 1X2 赔率换算的预期积分。</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {schedules.map((schedule) => (
          <button
            key={schedule.teamId}
            onClick={() => onSelect(schedule.teamId)}
            className="rounded-[6px] border border-white/[0.08] bg-white/[0.035] p-3 text-left transition hover:border-cyanline/35 hover:bg-cyanline/[0.08]"
          >
            <p className="truncate font-medium text-emerald-50">{schedule.teamName}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <OddsMetric label="场次" value={`${schedule.matches}`} accent="text-emerald-50" />
              <OddsMetric label="预期分" value={schedule.expectedPoints.toFixed(1)} accent="text-cyanline" />
              <OddsMetric label="预期PPG" value={schedule.expectedPpg.toFixed(2)} accent="text-line" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
});

// ---------------------------------------------------------------------------
// ProbabilityTable (L13: oddsMap optimization)
// ---------------------------------------------------------------------------
export const ProbabilityTable = React.memo(function ProbabilityTable({ league, onSelect }: { league: LeagueSnapshot; onSelect: (teamId: number) => void }) {
  const oddsMap = useMemo(
    () => new Map(league.odds?.teams.map((t) => [t.teamId, t]) ?? []),
    [league.odds]
  );

  return (
    <div className="rounded-[8px] border border-white/10 bg-pitch-900/72 p-4">
      <h2 className="mb-4 font-semibold text-emerald-50">冠军概率榜</h2>
      <div className="space-y-4">
        {league.titleProbabilities.slice(0, 8).map((team, index) => {
          const teamOdds = oddsMap.get(team.teamId);
          return (
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
              {teamOdds ? (
                <div className="mb-3 grid grid-cols-3 gap-2 rounded-[6px] bg-white/[0.035] px-3 py-2 text-xs">
                  <OddsMetric label="模型" value={formatPercent(team.probability)} accent="text-line" />
                  <OddsMetric label="赔率" value={formatPercent(teamOdds.consensusProbability)} accent="text-cyanline" />
                  <OddsMetric label="差值" value={formatPercent(team.probability - teamOdds.consensusProbability)} accent={team.probability >= teamOdds.consensusProbability ? 'text-line' : 'text-danger'} />
                </div>
              ) : null}
              <ProbabilityBar value={team.probability} compact />
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// featureLabel
// ---------------------------------------------------------------------------
export function featureLabel(key: keyof ProbabilityFeatures): string {
  const labels: Record<keyof ProbabilityFeatures, string> = {
    pointsPerGame: '场均积分',
    pointsGapAdjusted: '积分差修正',
    goalDiffPerGame: '场均净胜球',
    recentPpg: '近期场均积分',
    remainingScheduleAdvantage: '剩余赛程优势'
  };
  return labels[key] ?? key;
}

// ---------------------------------------------------------------------------
// TeamDrawer
// ---------------------------------------------------------------------------
export const TeamDrawer = React.memo(function TeamDrawer({
  team,
  teamOdds,
  matchOdds,
  standing,
  onClose
}: {
  team: TitleProbability;
  teamOdds?: TeamOdds;
  matchOdds?: LeagueMatchOdds;
  standing?: TeamStanding;
  onClose: () => void;
}) {
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
              <div className="mt-1.5 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-50/50">
                  较上次 <Delta value={team.probabilityDeltaPrevious} />
                </span>
                <span className="flex items-center gap-1 text-emerald-50/50">
                  近7天 <Delta value={team.probabilityDelta7d} />
                </span>
              </div>
            </div>
          </div>
          <button className="rounded-[6px] p-2 text-emerald-50/60 hover:bg-white/[0.08] hover:text-emerald-50" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        {standing ? (
          <div className="mb-5 grid grid-cols-3 gap-2">
            {([
              ['排名', standing.position],
              ['积分', standing.points],
              ['净胜球', standing.goalDifference],
              ['场次', standing.playedGames],
              ['进球', standing.goalsFor],
              ['失球', standing.goalsAgainst]
            ] as Array<[string, number]>).map(([label, value]) => (
              <div key={label} className="rounded-[6px] border border-white/10 bg-white/[0.045] p-3">
                <p className="text-xs text-emerald-50/45">{label}</p>
                <p className="mt-1 font-mono text-lg text-emerald-50">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {teamOdds ? <OddsBreakdown teamOdds={teamOdds} modelProbability={team.probability} /> : null}
        {matchOdds ? <TeamMatchOddsBreakdown teamId={team.teamId} matchOdds={matchOdds} /> : null}
        <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
          <h3 className="mb-3 font-semibold text-emerald-50">模型特征</h3>
          <div className="space-y-3">
            {features.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-emerald-50/58">{featureLabel(key as keyof ProbabilityFeatures)}</span>
                <span className="font-mono text-emerald-50">{Number(value).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
          <h3 className="mb-2 font-semibold text-emerald-50">模型说明</h3>
          <p className="text-sm leading-6 text-emerald-50/58">
            规则模型综合积分效率、与榜首差距、净胜球效率、近期状态和剩余赛程强度；特征在联赛内归一化后用 softmax 转换为冠军概率。
          </p>
        </div>
      </aside>
    </div>
  );
});

// ---------------------------------------------------------------------------
// TeamMatchOddsBreakdown
// ---------------------------------------------------------------------------
export const TeamMatchOddsBreakdown = React.memo(function TeamMatchOddsBreakdown({ teamId, matchOdds }: { teamId: number; matchOdds: LeagueMatchOdds }) {
  const teamMatches = matchOdds.matches.filter((match) => match.homeTeamId === teamId || match.awayTeamId === teamId).slice(0, 5);
  if (!teamMatches.length) return null;

  return (
    <div className="mb-4 rounded-[8px] border border-cyanline/20 bg-cyanline/[0.06] p-4">
      <h3 className="mb-3 font-semibold text-emerald-50">未来赔率赛程</h3>
      <div className="space-y-2">
        {teamMatches.map((match) => (
          <TeamMatchOddsRow key={`${match.homeTeamId}-${match.awayTeamId}-${match.utcDate}`} teamId={teamId} match={match} />
        ))}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// TeamMatchOddsRow
// ---------------------------------------------------------------------------
export const TeamMatchOddsRow = React.memo(function TeamMatchOddsRow({ teamId, match }: { teamId: number; match: MatchOdds }) {
  const opponent = teamId === match.homeTeamId ? match.awayTeamName : match.homeTeamName;
  const expectedPoints = expectedPointsForTeam(teamId, match);
  return (
    <div className="rounded-[6px] bg-white/[0.04] px-3 py-2 text-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="truncate text-emerald-50/75">vs {opponent}</span>
        <span className="font-mono text-cyanline">预期 {expectedPoints.toFixed(2)} 分</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {match.outcomes.slice(0, 3).map((outcome) => (
          <OddsMetric key={outcome.name} label={outcome.name} value={formatPercent(outcome.impliedProbability)} accent="text-emerald-50" />
        ))}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// OddsBreakdown
// ---------------------------------------------------------------------------
export const OddsBreakdown = React.memo(function OddsBreakdown({ teamOdds, modelProbability }: { teamOdds: TeamOdds; modelProbability: number }) {
  const sortedOdds = [...teamOdds.bookmakerOdds].sort((a, b) => a.oddsDecimal - b.oddsDecimal);
  return (
    <div className="mb-4 rounded-[8px] border border-cyanline/20 bg-cyanline/[0.06] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-emerald-50">机构赔率</h3>
        <span className="font-mono text-xs text-cyanline">共识 {formatPercent(teamOdds.consensusProbability)}</span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <OddsMetric label="模型概率" value={formatPercent(modelProbability)} accent="text-line" />
        <OddsMetric label="模型-赔率" value={formatPercent(modelProbability - teamOdds.consensusProbability)} accent={modelProbability >= teamOdds.consensusProbability ? 'text-line' : 'text-danger'} />
      </div>
      <div className="space-y-2">
        {sortedOdds.slice(0, 6).map((odds) => (
          <div key={`${odds.bookmaker}-${odds.lastUpdated}`} className="flex items-center justify-between gap-3 rounded-[6px] bg-white/[0.04] px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-emerald-50/70">{odds.bookmaker}</span>
            <span className="font-mono text-emerald-50">{odds.oddsDecimal.toFixed(2)}</span>
            <span className="font-mono text-cyanline">{formatPercent(odds.impliedProbability)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
