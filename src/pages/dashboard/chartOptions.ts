import type { ChartOption } from '../../components/Chart';
import { leagueLeaderTrend } from '../../lib/history';
import type { Snapshot } from '../../types';

export function leaderBarOption(snapshot: Snapshot): ChartOption {
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

export function leaderTrendOption(historySnapshots: Snapshot[]): ChartOption {
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
