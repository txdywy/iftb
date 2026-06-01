import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption
} from 'echarts/components';
import '../lib/chartTheme';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>;

interface ChartProps {
  option: ChartOption;
  className?: string;
}

export function Chart({ option, className = '' }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // Initialize once per mounted element; observe container resize so the chart
  // reflows inside flex/grid layouts, not just on window resize.
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, 'iftb-dark');
    chartRef.current = chart;

    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    observer.observe(ref.current);

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update options in place instead of recreating the instance on each render.
  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={`chart w-full ${className}`} />;
}
