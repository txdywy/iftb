import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadLatestSnapshot, loadRecentSnapshots } from './lib/data';
import { Dashboard } from './pages/Dashboard';
import { LeaguePage } from './pages/LeaguePage';
import type { Snapshot } from './types';

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [historySnapshots, setHistorySnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadLatestSnapshot(), loadRecentSnapshots()])
      .then(([data, history]) => {
        if (!active) return;
        setSnapshot(data);
        setHistorySnapshots(history.length ? history : [data]);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : '数据加载失败');
      });
    return () => {
      active = false;
    };
  }, []);

  const generatedAt = useMemo(() => {
    if (!snapshot) return null;
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(snapshot.generatedAt));
  }, [snapshot]);

  return (
    <AppShell>
      <ErrorBoundary>
      {error ? <ErrorState message={error} /> : null}
      {!snapshot && !error ? <LoadingState /> : null}
      {snapshot ? (
        <>
          <div className="mb-6 flex flex-col justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.045] p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-emerald-50/58">最新快照</p>
              <p className="mt-1 font-mono text-sm text-line">{generatedAt}</p>
            </div>
            <div className="flex gap-2 text-xs text-emerald-50/58">
              <span className="rounded-[6px] border border-line/20 bg-line/10 px-2.5 py-1 text-line">{snapshot.modelVersion}</span>
              <span className="rounded-[6px] border border-white/10 bg-white/5 px-2.5 py-1">{snapshot.leagues.length} leagues</span>
            </div>
          </div>
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard snapshot={snapshot} historySnapshots={historySnapshots} />} />
            <Route path="/leagues/:leagueId" element={<LeaguePage snapshot={snapshot} historySnapshots={historySnapshots} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </>
      ) : null}
      </ErrorBoundary>
    </AppShell>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[50vh] place-items-center rounded-[8px] border border-white/10 bg-white/[0.04]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-transparent" />
        <p className="text-sm text-emerald-50/65">读取冠军概率数据</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] border border-danger/40 bg-danger/10 p-4 text-sm text-red-100">
      {message}
    </div>
  );
}
