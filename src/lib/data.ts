import type { HistoryIndex, Snapshot } from '../types';

export async function loadLatestSnapshot(): Promise<Snapshot> {
  const response = await fetch(dataUrl('data/latest.json'), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load latest data: ${response.status}`);
  }
  return response.json() as Promise<Snapshot>;
}

export async function loadHistoryIndex(): Promise<HistoryIndex> {
  const response = await fetch(dataUrl('data/history/index.json'), { cache: 'no-store' });
  if (!response.ok) {
    return { snapshots: [] };
  }
  return response.json() as Promise<HistoryIndex>;
}

export async function loadSnapshot(path: string): Promise<Snapshot | null> {
  const response = await fetch(dataUrl(path), { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json() as Promise<Snapshot>;
}

export async function loadRecentSnapshots(limit = 40): Promise<Snapshot[]> {
  const index = await loadHistoryIndex();
  const entries = index.snapshots.slice(0, limit);
  const snapshots = await Promise.all(entries.map((entry) => loadSnapshot(entry.path)));
  return snapshots
    .filter((snapshot): snapshot is Snapshot => snapshot !== null)
    .sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));
}

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
