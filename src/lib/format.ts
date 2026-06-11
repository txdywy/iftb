export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDelta(value?: number): string {
  if (value === undefined) return '—';
  const percent = value * 100;
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}pp`;
}
