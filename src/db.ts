import Dexie, { type Table } from 'dexie';
import type { Entry, Food, Goals, Profile, Setting, SyncMeta, Weight } from './types';
import { DEFAULT_GOALS } from './lib/nutrients';

class NutritionDB extends Dexie {
  foods!: Table<Food, string>;
  entries!: Table<Entry, string>;
  weights!: Table<Weight, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('nutricion');
    this.version(1).stores({
      foods: 'id, name, barcode, updatedAt, lastUsedAt',
      entries: 'id, date, foodId, updatedAt',
      weights: 'id, date, updatedAt',
      settings: 'id, updatedAt',
    });
  }
}

export const db = new NutritionDB();
export type SyncTable = 'foods' | 'entries' | 'weights' | 'settings';
export const SYNC_TABLES: SyncTable[] = ['foods', 'entries', 'weights', 'settings'];

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/** Fired after every local write; the sync module debounces on it. */
export const CHANGE_EVENT = 'nutricion:change';
const changed = () => window.dispatchEvent(new Event(CHANGE_EVENT));

async function put<T extends SyncMeta>(table: Table<T, string>, rec: T) {
  await table.put({ ...rec, updatedAt: Date.now() });
  changed();
}

async function tombstone<T extends SyncMeta>(table: Table<T, string>, id: string) {
  const rec = await table.get(id);
  if (!rec) return;
  await table.put({ ...rec, deleted: 1, updatedAt: Date.now() });
  changed();
}

export const alive = <T extends SyncMeta>(r: T) => !r.deleted;

// ---------- foods ----------
export const saveFood = (f: Food) => put(db.foods, f);
export const deleteFood = (id: string) => tombstone(db.foods, id);
export async function touchFood(id: string) {
  const f = await db.foods.get(id);
  if (f) await put(db.foods, { ...f, lastUsedAt: Date.now() });
}

// ---------- entries ----------
export const saveEntry = (e: Entry) => put(db.entries, e);
export const deleteEntry = (id: string) => tombstone(db.entries, id);
export const entriesForDate = (date: string) =>
  db.entries.where('date').equals(date).filter(alive).sortBy('createdAt');
export const entriesBetween = (from: string, to: string) =>
  db.entries.where('date').between(from, to, true, true).filter(alive).toArray();

// ---------- weights ----------
export const saveWeight = (date: string, kg: number) =>
  put(db.weights, { id: date, date, kg, updatedAt: 0 });
export const deleteWeight = (date: string) => tombstone(db.weights, date);

// ---------- settings ----------
export async function getSetting<T>(id: string, fallback: T): Promise<T> {
  const s = await db.settings.get(id);
  return s && !s.deleted ? (s.value as T) : fallback;
}
export const setSetting = (id: string, value: unknown) => put(db.settings, { id, value, updatedAt: 0 });

export const getGoals = () => getSetting<Goals>('goals', DEFAULT_GOALS);
export const getProfile = () => getSetting<Profile | null>('profile', null);

// ---------- backup ----------
export interface Snapshot {
  version: 1;
  exportedAt: number;
  foods: Food[];
  entries: Entry[];
  weights: Weight[];
  settings: Setting[];
}

export async function exportAll(): Promise<Snapshot> {
  const [foods, entries, weights, settings] = await Promise.all([
    db.foods.toArray(), db.entries.toArray(), db.weights.toArray(), db.settings.toArray(),
  ]);
  return { version: 1, exportedAt: Date.now(), foods, entries, weights, settings };
}

/**
 * Last-writer-wins merge per record (by updatedAt). Tombstones are kept so deletions propagate.
 * Returns true if any local record changed.
 */
export async function mergeSnapshot(snap: Partial<Snapshot>): Promise<boolean> {
  let touched = false;
  await db.transaction('rw', [db.foods, db.entries, db.weights, db.settings], async () => {
    for (const t of SYNC_TABLES) {
      const incoming = (snap[t] ?? []) as SyncMeta[];
      if (!incoming.length) continue;
      const table = db[t] as unknown as Table<SyncMeta, string>;
      const local = await table.bulkGet(incoming.map((r) => r.id));
      const newer = incoming.filter((r, i) => !local[i] || (local[i]!.updatedAt ?? 0) < (r.updatedAt ?? 0));
      if (newer.length) {
        await table.bulkPut(newer);
        touched = true;
      }
    }
  });
  return touched;
}
