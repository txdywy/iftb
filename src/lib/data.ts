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

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
