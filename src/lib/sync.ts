/**
 * Optional cross-device sync through a private GitHub Gist.
 * The gist holds one JSON snapshot; each device merges record-by-record (last-writer-wins on updatedAt),
 * then uploads the merged result. Free, no server, and the user already has a GitHub account.
 */
import { CHANGE_EVENT, exportAll, mergeSnapshot, type Snapshot } from '../db';
import { KEYS, lsGet, lsSet } from './local';

const FILE = 'nutricion.json';
const API = 'https://api.github.com';

export type SyncStatus = { state: 'off' | 'idle' | 'syncing' | 'error'; message?: string; at?: number };

let status: SyncStatus = { state: lsGet(KEYS.ghToken) ? 'idle' : 'off', at: Number(lsGet(KEYS.lastSync)) || undefined };
const listeners = new Set<(s: SyncStatus) => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l(s));
};
export const getSyncStatus = () => status;
export const onSyncStatus = (l: (s: SyncStatus) => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function gh(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

/** Find an existing nutricion gist, or create a private one. */
async function ensureGist(token: string): Promise<string> {
  const known = lsGet(KEYS.gistId);
  if (known) return known;
  for (let page = 1; page <= 5; page++) {
    const list: { id: string; files: Record<string, unknown> }[] = await gh(`/gists?per_page=100&page=${page}`, token);
    const hit = list.find((g) => FILE in g.files);
    if (hit) {
      lsSet(KEYS.gistId, hit.id);
      return hit.id;
    }
    if (list.length < 100) break;
  }
  const created = await gh('/gists', token, {
    method: 'POST',
    body: JSON.stringify({
      description: 'Nutrición — datos de la app (sincronización)',
      public: false,
      files: { [FILE]: { content: JSON.stringify(await exportAll()) } },
    }),
  });
  lsSet(KEYS.gistId, created.id);
  return created.id;
}

async function readRemote(token: string, id: string): Promise<Partial<Snapshot> | null> {
  const g = await gh(`/gists/${id}`, token);
  const f = g.files?.[FILE];
  if (!f) return null;
  // Large files are truncated in the gist payload; fetch the raw content instead.
  const text: string = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  return text ? JSON.parse(text) : null;
}

let running: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  const token = lsGet(KEYS.ghToken);
  if (!token) {
    setStatus({ state: 'off' });
    return Promise.resolve();
  }
  if (running) return running;
  setStatus({ ...status, state: 'syncing' });
  running = (async () => {
    try {
      const id = await ensureGist(token);
      const remote = await readRemote(token, id);
      if (remote) await mergeSnapshot(remote);
      const merged = await exportAll();
      const remoteJson = remote ? JSON.stringify({ ...remote, exportedAt: 0 }) : '';
      // Skip the upload when nothing changed locally relative to remote.
      if (remoteJson !== JSON.stringify({ ...merged, exportedAt: 0 })) {
        await gh(`/gists/${id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(merged) } } }),
        });
      }
      const at = Date.now();
      lsSet(KEYS.lastSync, String(at));
      setStatus({ state: 'idle', at });
    } catch (e) {
      setStatus({ state: 'error', message: (e as Error).message, at: status.at });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sync on start, after local edits (debounced), when the tab regains focus, and when back online. */
export function startAutoSync() {
  let timer: number | undefined;
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), ms);
  };
  window.addEventListener(CHANGE_EVENT, () => schedule(4000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(500);
  });
  window.addEventListener('online', () => schedule(500));
  schedule(800);
}

export function disconnectSync() {
  lsSet(KEYS.ghToken, '');
  lsSet(KEYS.gistId, '');
  lsSet(KEYS.lastSync, '');
  setStatus({ state: 'off' });
}
