import type { ChartOption } from '../../components/Chart';
import { contendersTrend } from '../../lib/history';
import type { LeagueSnapshot, Snapshot } from '../../types';

export function probabilityChartOption(league: LeagueSnapshot): ChartOption {
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

export function probabilityTrendOption(league: LeagueSnapshot, historySnapshots: Snapshot[]): ChartOption {
  const teamIds = league.titleProbabilities.slice(0, 5).map((team) => team.teamId);
  const trend = contendersTrend(historySnapshots, league.id, teamIds);
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { top: 0, textStyle: { color: '#b8d5ca' } },
    grid: { left: 42, right: 18, top: 56, bottom: 48 },
    dataZoom: [{ type: 'inside' as const }, { type: 'slider' as const, height: 18, bottom: 8 }],
    xAxis: {
      type: 'category' as const,
      data: trend.labels,
      boundaryGap: false
    },
    yAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { formatter: (value: number) => `${value}%` }
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
