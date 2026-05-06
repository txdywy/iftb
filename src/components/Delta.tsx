import { formatDelta } from '../lib/format';

export function Delta({ value }: { value?: number }) {
  const color = value === undefined ? 'text-emerald-50/45' : value >= 0 ? 'text-line' : 'text-danger';
  return <span className={`font-mono text-xs ${color}`}>{formatDelta(value)}</span>;
}
