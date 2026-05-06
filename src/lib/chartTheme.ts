import * as echarts from 'echarts/core';

export const chartPalette = ['#6bf2b8', '#52d9ff', '#ffcf5c', '#ff6b81', '#b797ff', '#f6f7ef'];

echarts.registerTheme('iftb-dark', {
  color: chartPalette,
  backgroundColor: 'transparent',
  textStyle: {
    color: '#d8fbe8',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
  },
  grid: {
    borderColor: 'rgba(232, 255, 244, 0.12)'
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(232, 255, 244, 0.24)' } },
    axisTick: { show: false },
    axisLabel: { color: '#91aa9f' },
    splitLine: { show: false }
  },
  valueAxis: {
    axisLabel: { color: '#91aa9f' },
    splitLine: { lineStyle: { color: 'rgba(232, 255, 244, 0.08)' } }
  },
  tooltip: {
    backgroundColor: 'rgba(10, 23, 20, 0.96)',
    borderColor: 'rgba(107, 242, 184, 0.35)',
    textStyle: { color: '#e8fff4' }
  }
});
