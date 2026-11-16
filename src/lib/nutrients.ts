import type { Entry, Goals, Meal, Nutrients, NutrientKey } from '../types';

export const NUTRIENT_KEYS: NutrientKey[] = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satFat', 'fiber', 'salt'];

export const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  kcal: 'Energía',
  protein: 'Proteínas',
  carbs: 'Hidratos',
  sugar: 'de los cuales azúcares',
  fat: 'Grasas',
  satFat: 'de las cuales saturadas',
  fiber: 'Fibra',
  salt: 'Sal',
};

export const NUTRIENT_UNIT: Record<NutrientKey, string> = {
  kcal: 'kcal', protein: 'g', carbs: 'g', sugar: 'g', fat: 'g', satFat: 'g', fiber: 'g', salt: 'g',
};

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch', label: 'Comida' },
  { key: 'dinner', label: 'Cena' },
  { key: 'snack', label: 'Snacks' },
];

export const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label])) as Record<Meal, string>;

export const emptyNutrients = (): Nutrients => ({
  kcal: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, satFat: 0, fiber: 0, salt: 0,
});

export const DEFAULT_GOALS: Goals = { kcal: 2200, protein: 140, carbs: 240, fat: 75, fiber: 30, sugar: 50, salt: 6 };

export function scale(per100: Nutrients, amount: number): Nutrients {
  const f = amount / 100;
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = (per100[k] || 0) * f;
  return out;
}

export function sum(list: Nutrients[]): Nutrients {
  const out = emptyNutrients();
  for (const n of list) for (const k of NUTRIENT_KEYS) out[k] += n[k] || 0;
  return out;
}

export const entryNutrients = (e: Entry) => scale(e.per100, e.amount);
export const totals = (entries: Entry[]) => sum(entries.map(entryNutrients));

export function fmt(v: number, key: NutrientKey | 'g' = 'g'): string {
  if (!Number.isFinite(v)) return '0';
  if (key === 'kcal') return Math.round(v).toLocaleString('es-ES');
  if (key === 'salt' || Math.abs(v) < 10) return (Math.round(v * 10) / 10).toLocaleString('es-ES');
  return Math.round(v).toLocaleString('es-ES');
}

/** Energy implied by macros (Atwater). Used to sanity-check scanned labels. */
export const kcalFromMacros = (n: Pick<Nutrients, 'protein' | 'carbs' | 'fat' | 'fiber'>) =>
  4 * n.protein + 4 * Math.max(0, n.carbs) + 9 * n.fat + 2 * (n.fiber || 0);

/** Mifflin–St Jeor BMR × activity, with an objective adjustment; macros: protein by bodyweight, fat 27 %, rest carbs. */
export function suggestGoals(p: {
  sex: 'male' | 'female'; age: number; heightCm: number; weightKg: number; activity: number;
  objective: 'lose' | 'maintain' | 'gain';
}): Goals {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * p.activity;
  const adj = p.objective === 'lose' ? 0.8 : p.objective === 'gain' ? 1.1 : 1;
  const kcal = Math.round((tdee * adj) / 10) * 10;
  const protein = Math.round(p.weightKg * (p.objective === 'lose' ? 2.0 : p.objective === 'gain' ? 1.8 : 1.6));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    kcal, protein, carbs, fat,
    fiber: Math.round((kcal / 1000) * 14),
    sugar: Math.round((kcal * 0.1) / 4),
    salt: 5,
  };
}
