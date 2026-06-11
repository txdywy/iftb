import type { HistoryIndex, Snapshot } from '../types';

const CACHE_KEY = 'iftb-latest-snapshot';

function validateSnapshotShape(data: unknown): data is Snapshot {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.generatedAt !== 'string') return false;
  if (typeof obj.modelVersion !== 'string') return false;
  if (!Array.isArray(obj.leagues) || obj.leagues.length !== 5) return false;
  for (const league of obj.leagues) {
    if (!league || typeof league !== 'object') return false;
    const l = league as Record<string, unknown>;
    if (typeof l.id !== 'string' || typeof l.name !== 'string') return false;
    if (!Array.isArray(l.standings) || !Array.isArray(l.titleProbabilities)) return false;
  }
  return true;
}

export async function loadLatestSnapshot(): Promise<Snapshot> {
  try {
    const response = await fetch(dataUrl('data/latest.json'), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Failed to load latest data: ${response.status}`);
    const data: unknown = await response.json();
    if (!validateSnapshotShape(data)) throw new Error('数据格式校验失败');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
    return data;
  } catch (err) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data: unknown = JSON.parse(cached);
      if (validateSnapshotShape(data)) return data;
    }
    throw err;
  }
}

async function loadHistoryIndex(): Promise<HistoryIndex> {
  const response = await fetch(dataUrl('data/history/index.json'), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    return { snapshots: [] };
  }
  try {
    return await response.json() as Promise<HistoryIndex>;
  } catch {
    return { snapshots: [] };
  }
}

export async function loadSnapshot(path: string): Promise<Snapshot | null> {
  if (path.includes('..')) return null;
  // History snapshots live at immutable, timestamped paths, so they are safe to
  // cache and reuse across visits instead of re-downloading every load.
  const response = await fetch(dataUrl(path), { cache: 'force-cache', signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  try {
    const data: unknown = await response.json();
    if (!validateSnapshotShape(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loadRecentSnapshots(limit = 40): Promise<Snapshot[]> {
  const index = await loadHistoryIndex();
  const entries = index.snapshots.slice(0, limit);
  const results = await Promise.allSettled(entries.map((entry) => loadSnapshot(entry.path)));
  return results
    .filter((result): result is PromiseFulfilledResult<Snapshot> => result.status === 'fulfilled' && result.value !== null)
    .map((result) => result.value)
    .sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));
}

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
