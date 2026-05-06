import { Activity, Gauge, Trophy } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { LEAGUES } from '../data/leagues';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-pitch-950/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[8px] border border-line/30 bg-line/10 text-line shadow-glow">
              <Trophy size={20} />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-tight text-emerald-50">五大联赛冠军概率追踪器</span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-emerald-50/55">
                <Gauge size={14} />
                Rule model MVP
              </span>
            </span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-[6px] px-3 py-2 text-sm ${isActive ? 'bg-line/15 text-line' : 'text-emerald-50/62 hover:bg-white/[0.08] hover:text-emerald-50'}`
              }
            >
              总览
            </NavLink>
            {LEAGUES.map((league) => (
              <NavLink
                key={league.id}
                to={`/leagues/${league.id}`}
                className={({ isActive }) =>
                  `rounded-[6px] px-3 py-2 text-sm ${isActive ? 'bg-line/15 text-line' : 'text-emerald-50/62 hover:bg-white/[0.08] hover:text-emerald-50'}`
                }
              >
                {league.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      <footer className="mx-auto flex max-w-7xl items-center gap-2 px-4 pb-8 text-xs text-emerald-50/45 sm:px-6">
        <Activity size={14} />
        数据源 football-data.org，概率为可解释规则模型估算。
      </footer>
    </div>
  );
}
