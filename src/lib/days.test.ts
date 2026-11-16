import { describe, expect, it } from 'vitest';
import type { Entry } from '../types';
import { addEntry, copyEntries, emptyDay, removeEntry, replaceEntry, setWeight } from './days';
import { scale, suggestGoals, totals } from './nutrients';

const per100 = { kcal: 200, protein: 10, carbs: 20, sugar: 5, fat: 8, satFat: 2, fiber: 3, salt: 0.5 };
const entry = (id: string, amount: number): Entry => ({
  id, date: '2026-11-16', meal: 'lunch', name: 'x', unit: 'g', per100, amount, createdAt: 1,
});

describe('day documents', () => {
  it('adds, replaces and removes entries immutably', () => {
    const d0 = emptyDay('2026-11-16');
    const d1 = addEntry(d0, entry('a', 150));
    expect(d0.entries).toHaveLength(0);
    expect(d1.entries).toHaveLength(1);
    const d2 = replaceEntry(d1, entry('a', 50));
    expect(d2.entries[0].amount).toBe(50);
    expect(removeEntry(d2, 'a').entries).toHaveLength(0);
  });

  it('copies entries with fresh ids and the target date', () => {
    const src = addEntry(emptyDay('2026-11-15'), { ...entry('a', 100), date: '2026-11-15' });
    let n = 0;
    const dst = copyEntries(src, emptyDay('2026-11-16'), () => `new${n++}`);
    expect(dst.entries[0]).toMatchObject({ id: 'new0', date: '2026-11-16', amount: 100 });
  });

  it('keeps weight', () => {
    expect(setWeight(emptyDay('2026-11-16'), 72.4).weightKg).toBe(72.4);
  });
});

describe('nutrients', () => {
  it('scales per 100 g and sums', () => {
    expect(scale(per100, 150).kcal).toBe(300);
    expect(totals([entry('a', 50), entry('b', 100)]).protein).toBe(15);
  });

  it('suggests goals whose macros add up to the energy target', () => {
    const g = suggestGoals({ sex: 'male', age: 25, heightCm: 175, weightKg: 70, activity: 1.55, objective: 'maintain' });
    expect(g.kcal).toBe(2590);
    expect(Math.abs(g.protein * 4 + g.carbs * 4 + g.fat * 9 - g.kcal)).toBeLessThan(10);
  });
});
