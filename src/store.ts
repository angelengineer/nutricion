/**
 * App state + persistence.
 *
 * Inside claude.ai the data lives in the artifact's `db` (cloud, any device, readable by Claude):
 *   foods/<id>        one document per saved food
 *   days/<YYYY-MM-DD> one document per day: entries + weight
 *   settings/main     goals + profile
 * Outside a Claude viewer (local dev, previews) it falls back to localStorage.
 */
import { useSyncExternalStore } from 'react';
import type { Day, Entry, Food, Goals, Profile, SettingsDoc } from './types';
import { DEFAULT_GOALS } from './lib/nutrients';
import { addDays, today } from './lib/date';
import * as D from './lib/days';

// ---- minimal typings for the Claude runtime (see artifact-capabilities db.d.ts) ----
type Snap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined; metadata: { fromCache: boolean } };
type QSnap = { docs: Snap[]; metadata: { fromCache: boolean } };
type DocRef = {
  set(d: object): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(n: (s: Snap) => void, e?: (err: { code: string; message: string }) => void): () => void;
};
type Coll = {
  doc(id: string): DocRef;
  where(f: string, op: string, v: unknown): Coll;
  onSnapshot(n: (s: QSnap) => void, e?: (err: { code: string; message: string }) => void): () => void;
};
type DB = { doc(p: string): DocRef; collection(p: string): Coll };
declare global {
  interface Window {
    claude?: { use(name: string): Promise<any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

export interface State {
  mode: 'loading' | 'cloud' | 'local';
  /** True once the first answer from the store arrived. */
  ready: boolean;
  /** Store hasn't confirmed data within 10 s. */
  slow: boolean;
  error?: string;
  foods: Food[];
  days: Record<string, Day>;
  goals: Goals;
  profile: Profile | null;
}

let state: State = { mode: 'loading', ready: false, slow: false, foods: [], days: {}, goals: DEFAULT_GOALS, profile: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useStore = () => useSyncExternalStore(subscribe, () => state);
export const getState = () => state;

export const uid = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** How far back we keep a live subscription (covers the 90-day view and a year of weight). */
export const LIVE_DAYS = 400;

// ---------------- backends ----------------
interface Backend {
  putFood(f: Food): Promise<void>;
  deleteFood(id: string): Promise<void>;
  putDay(d: Day): Promise<void>;
  putSettings(s: SettingsDoc): Promise<void>;
}

let backend: Backend | null = null;
let cloud: DB | null = null;

const LOCAL_KEY = 'nutricion.local.v1';
function localBackend(): Backend {
  let saved: { foods?: Food[]; days?: Record<string, Day>; settings?: SettingsDoc } = {};
  try {
    saved = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
  } catch {
    /* storage unavailable */
  }
  set({
    mode: 'local', ready: true,
    foods: saved.foods ?? [], days: saved.days ?? {},
    goals: saved.settings?.goals ?? DEFAULT_GOALS, profile: saved.settings?.profile ?? null,
  });
  const persist = async () => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({
        foods: state.foods, days: state.days, settings: { goals: state.goals, profile: state.profile },
      }));
    } catch {
      /* ignore */
    }
  };
  return { putFood: persist, deleteFood: persist, putDay: persist, putSettings: persist };
}

function cloudBackend(db: DB): Backend {
  cloud = db;
  const pending = { foods: true, days: true, settings: true };
  const confirmed = { foods: false, days: false, settings: false };
  const timer = setTimeout(() => set({ slow: true }), 10_000);
  const mark = (k: keyof typeof pending, fromCache: boolean) => {
    pending[k] = false;
    if (!fromCache) confirmed[k] = true;
    if (!pending.foods && !pending.days && !pending.settings && !state.ready) set({ ready: true });
    if (confirmed.foods && confirmed.days && confirmed.settings) {
      clearTimeout(timer);
      if (state.slow) set({ slow: false });
    }
  };
  const fail = (e: { code: string; message: string }) => {
    clearTimeout(timer);
    set({ error: errorText(e.code), ready: true });
  };

  db.collection('foods').onSnapshot((s) => {
    set({ foods: s.docs.map((d) => ({ ...(d.data() as unknown as Food), id: d.id })) });
    mark('foods', s.metadata.fromCache);
  }, fail);

  db.collection('days').where('date', '>=', addDays(today(), -LIVE_DAYS)).onSnapshot((s) => {
    const days: Record<string, Day> = {};
    // Keep any older day the user navigated to (watched separately).
    for (const [k, v] of Object.entries(state.days)) if (extraWatch.has(k)) days[k] = v;
    for (const d of s.docs) days[d.id] = d.data() as unknown as Day;
    set({ days });
    mark('days', s.metadata.fromCache);
  }, fail);

  db.doc('settings/main').onSnapshot((s) => {
    const v = s.exists ? (s.data() as unknown as SettingsDoc) : null;
    set({ goals: { ...DEFAULT_GOALS, ...v?.goals }, profile: v?.profile ?? null });
    mark('settings', s.metadata.fromCache);
  }, fail);

  set({ mode: 'cloud' });
  return {
    putFood: (f) => db.collection('foods').doc(f.id).set(f as unknown as Record<string, unknown>),
    deleteFood: (id) => db.collection('foods').doc(id).delete(),
    putDay: (d) => db.collection('days').doc(d.date).set(d as unknown as Record<string, unknown>),
    putSettings: (s) => db.doc('settings/main').set(s as unknown as Record<string, unknown>),
  };
}

function errorText(code: string): string {
  switch (code) {
    case 'quota_exceeded': return 'La base de datos está llena. Borra alimentos que no uses.';
    case 'revoked': return 'Se ha retirado el acceso a la base de datos en esta vista.';
    case 'invalid_argument': return 'No tienes permiso para guardar en esta app.';
    default: return 'No se pudo guardar. Revisa la conexión e inténtalo de nuevo.';
  }
}

export async function initStore() {
  const db: DB | null = window.claude ? await window.claude.use('db').catch(() => null) : null;
  backend = db ? cloudBackend(db) : localBackend();
}

// Older days outside the live window: subscribe on demand.
const extraWatch = new Map<string, () => void>();
export function watchDay(date: string): () => void {
  if (!cloud || date >= addDays(today(), -LIVE_DAYS) || extraWatch.has(date)) return () => {};
  const off = cloud.doc(`days/${date}`).onSnapshot((s) => {
    if (s.exists) set({ days: { ...state.days, [date]: s.data() as unknown as Day } });
  });
  extraWatch.set(date, off);
  return () => {
    off();
    extraWatch.delete(date);
  };
}

// ---------------- writes ----------------
// One write in flight per document; bursts coalesce to the latest value.
const queued = new Map<string, () => Promise<void>>();
const running = new Set<string>();
function enqueue(path: string, write: () => Promise<void>) {
  queued.set(path, write);
  if (running.has(path)) return;
  running.add(path);
  void (async () => {
    while (queued.has(path)) {
      const w = queued.get(path)!;
      queued.delete(path);
      try {
        await w();
        if (state.error) set({ error: undefined });
      } catch (e) {
        set({ error: errorText((e as { code?: string }).code ?? '') });
      }
    }
    running.delete(path);
  })();
}

const getDay = (date: string) => state.days[date] ?? D.emptyDay(date);
function writeDay(d: Day) {
  set({ days: { ...state.days, [d.date]: d } }); // optimistic
  enqueue(`days/${d.date}`, () => backend!.putDay(d));
}

export function saveFood(f: Food) {
  const food = { ...f, updatedAt: Date.now() };
  // JSON documents can't hold `undefined`.
  const clean = JSON.parse(JSON.stringify(food)) as Food;
  const exists = state.foods.some((x) => x.id === f.id);
  set({ foods: exists ? state.foods.map((x) => (x.id === f.id ? clean : x)) : [...state.foods, clean] });
  enqueue(`foods/${f.id}`, () => backend!.putFood(clean));
}

export function deleteFood(id: string) {
  set({ foods: state.foods.filter((f) => f.id !== id) });
  enqueue(`foods/${id}`, () => backend!.deleteFood(id));
}

export function touchFood(id: string) {
  const f = state.foods.find((x) => x.id === id);
  if (f) saveFood({ ...f, lastUsedAt: Date.now() });
}

const cleanEntry = (e: Entry) => JSON.parse(JSON.stringify(e)) as Entry;
export const addEntry = (e: Entry) => writeDay(D.addEntry(getDay(e.date), cleanEntry(e)));
export const updateEntry = (e: Entry) => writeDay(D.replaceEntry(getDay(e.date), cleanEntry(e)));
export const deleteEntry = (date: string, id: string) => writeDay(D.removeEntry(getDay(date), id));
export const copyDay = (from: string, to: string) => writeDay(D.copyEntries(getDay(from), getDay(to), uid));
export const saveWeight = (date: string, kg: number | null) => writeDay(D.setWeight(getDay(date), kg));

export function saveSettings(patch: Partial<SettingsDoc>) {
  const next: SettingsDoc = { goals: state.goals, profile: state.profile, ...patch };
  set(next);
  enqueue('settings/main', () => backend!.putSettings(JSON.parse(JSON.stringify(next))));
}

// ---------------- selectors ----------------
export const entriesFor = (s: State, date: string) =>
  [...(s.days[date]?.entries ?? [])].sort((a, b) => a.createdAt - b.createdAt);

/** Import a JSON backup (this app's export format). */
export function importBackup(data: { foods?: Food[]; days?: Day[]; settings?: SettingsDoc }) {
  for (const f of data.foods ?? []) saveFood(f);
  for (const d of data.days ?? []) writeDay({ ...D.emptyDay(d.date), ...d });
  if (data.settings) saveSettings(data.settings);
}

export const exportBackup = () => ({
  version: 2,
  exportedAt: new Date().toISOString(),
  foods: state.foods,
  days: Object.values(state.days).sort((a, b) => a.date.localeCompare(b.date)),
  settings: { goals: state.goals, profile: state.profile },
});
