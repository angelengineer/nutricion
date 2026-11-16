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

export interface Food {
  id: string;
  name: string;
  brand?: string;
  /** Values per 100 g (or 100 ml). */
  per100: Nutrients;
  /** Typical serving in grams, if known. */
  servingG?: number;
  unit: 'g' | 'ml';
  favorite?: boolean;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Entry {
  id: string;
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

/** One stored document per calendar day: keeps the store far below its document cap. */
export interface Day {
  date: string;
  entries: Entry[];
  weightKg?: number | null;
  updatedAt: number;
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

export interface SettingsDoc {
  goals: Goals;
  profile: Profile | null;
}
