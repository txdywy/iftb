interface TeamCrestProps {
  name: string;
  crest?: string;
  size?: 'sm' | 'md';
}

export function TeamCrest({ name, crest, size = 'md' }: TeamCrestProps) {
  const dimensions = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  if (crest) {
    return (
      <span className={`${dimensions} grid shrink-0 place-items-center rounded-[6px] bg-white/90 p-1`}>
        <img src={crest} alt="" className="max-h-full max-w-full object-contain" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </span>
    );
  }

  return (
    <span className={`${dimensions} grid shrink-0 place-items-center rounded-[6px] border border-line/20 bg-line/10 font-mono text-xs text-line`}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
