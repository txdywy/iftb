import { formatPercent } from '../lib/format';

interface ProbabilityBarProps {
  value: number;
  label?: string;
  compact?: boolean;
}

export function ProbabilityBar({ value, label, compact = false }: ProbabilityBarProps) {
  return (
    <div className="min-w-0">
      {label ? (
        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-emerald-50/70">
          <span className="truncate">{label}</span>
          <span className="font-mono text-emerald-100">{formatPercent(value)}</span>
        </div>
      ) : null}
      <div className={`overflow-hidden rounded-[6px] bg-white/[0.08] ${compact ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className="h-full rounded-[6px] bg-gradient-to-r from-line to-cyanline shadow-glow"
          style={{ width: `${Math.max(value * 100, value > 0 ? 1 : 0)}%` }}
        />
      </div>
    </div>
  );
}
