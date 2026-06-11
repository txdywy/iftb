import type { LeagueSnapshot } from '../types';

interface LeagueEmblemProps {
  league: Pick<LeagueSnapshot, 'name' | 'emblem'>;
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
}

const sizes = {
  sm: 'h-9 w-9 p-1.5',
  md: 'h-12 w-12 p-2',
  lg: 'h-16 w-16 p-2.5'
};

export function LeagueEmblem({ league, size = 'md', muted = false }: LeagueEmblemProps) {
  const className = `${sizes[size]} grid shrink-0 place-items-center rounded-[8px] border border-line/25 bg-white/[0.06] ${muted ? 'opacity-20' : 'shadow-glow'}`;
  if (league.emblem) {
    return (
      <span className={className}>
        <img src={league.emblem} alt="" className="max-h-full max-w-full object-contain" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </span>
    );
  }

  return <span className={`${className} font-mono text-xs text-line`}>{league.name.slice(0, 2)}</span>;
}
