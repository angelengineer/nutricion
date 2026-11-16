export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  sugar: number;
  fat: number;
  satFat: number;
  fiber: number;
  salt: number;
}

export type NutrientKey = keyof Nutrients;

/** Fields shared by every synced record. `deleted` is a tombstone so deletions propagate on sync. */
export interface SyncMeta {
  id: string;
  updatedAt: number;
  deleted?: 0 | 1;
}

export interface Food extends SyncMeta {
  name: string;
  brand?: string;
  barcode?: string;
  /** Values per 100 g (or 100 ml). */
  per100: Nutrients;
  /** Typical serving in grams, if known. */
  servingG?: number;
  unit: 'g' | 'ml';
  favorite?: boolean;
  lastUsedAt?: number;
  createdAt: number;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Entry extends SyncMeta {
  /** Local date, YYYY-MM-DD. */
  date: string;
  meal: Meal;
  foodId?: string;
  /** Snapshot of the food at log time, so editing the food later doesn't rewrite history. */
  name: string;
  brand?: string;
  unit: 'g' | 'ml';
  per100: Nutrients;
  amount: number;
  createdAt: number;
}

export interface Weight extends SyncMeta {
  /** id === date: one weigh-in per day. */
  date: string;
  kg: number;
}

export interface Goals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
}

export interface Profile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  objective: 'lose' | 'maintain' | 'gain';
}

/** Key-value settings that sync across devices. */
export interface Setting extends SyncMeta {
  value: unknown;
}
