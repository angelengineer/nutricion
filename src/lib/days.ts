// Pure day-document operations (unit-tested).
import type { Day, Entry } from '../types';

export const emptyDay = (date: string): Day => ({ date, entries: [], weightKg: null, updatedAt: 0 });

const touch = (d: Day): Day => ({ ...d, updatedAt: Date.now() });

export const addEntry = (d: Day, e: Entry): Day => touch({ ...d, entries: [...d.entries, e] });

export const replaceEntry = (d: Day, e: Entry): Day =>
  touch({ ...d, entries: d.entries.map((x) => (x.id === e.id ? e : x)) });

export const removeEntry = (d: Day, id: string): Day =>
  touch({ ...d, entries: d.entries.filter((x) => x.id !== id) });

export const setWeight = (d: Day, kg: number | null): Day => touch({ ...d, weightKg: kg });

/** Copy entries of `src` onto `dst` with fresh ids. */
export function copyEntries(src: Day, dst: Day, newId: () => string): Day {
  const now = Date.now();
  const copies = src.entries.map((e, i) => ({ ...e, id: newId(), date: dst.date, createdAt: now + i }));
  return touch({ ...dst, entries: [...dst.entries, ...copies] });
}
