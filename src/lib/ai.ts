/**
 * Nutrition reading/estimation through the artifact's `sample` capability (the viewer's own Claude).
 * One photo prompt handles both nutrition-facts labels and pictures of food/dishes.
 */
import type { Nutrients } from '../types';
import { NUTRIENT_KEYS } from './nutrients';

export interface AiFood {
  kind: 'label' | 'estimate';
  name: string;
  brand: string | null;
  unit: 'g' | 'ml';
  servingG: number | null;
  /** Estimated amount eaten/shown (dish photo or quantity in the description). */
  portionG: number | null;
  per100: Nutrients;
  notes: string;
}

type SampleFn = {
  json<T>(input: string, opts?: { images?: Blob[]; modelTier?: string; cache?: boolean }): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>;
};

let samplePromise: Promise<SampleFn | null> | null = null;
const getSample = () =>
  (samplePromise ??= window.claude ? window.claude.use('sample').catch(() => null) : Promise.resolve(null));

export async function aiCapabilities(): Promise<{ text: boolean; images: boolean }> {
  const s = await getSample();
  if (!s) return { text: false, images: false };
  const lim = await s.limits().catch(() => null);
  return { text: true, images: !!lim?.images };
}

const FORMAT = `Reply with only one JSON object, no other text:
{"kind":"label"|"estimate","name":string,"brand":string|null,"unit":"g"|"ml","servingG":number|null,"portionG":number|null,
 "per100":{"kcal":number,"protein":number,"carbs":number,"sugar":number,"fat":number,"satFat":number,"fiber":number,"salt":number},
 "notes":string}
Rules for every field:
- per100: values PER 100 g (or 100 ml for drinks). kcal in kilocalories; all others in grams. Use 0 when a nutrient is truly absent.
- carbs = total carbohydrates as EU labels print them (Japanese 炭水化物; if only 糖質 and 食物繊維 are given, carbs = 糖質).
- salt in grams; if only sodium is known, salt = sodium × 2.5 (mg → g).
- name: short product or dish name in Spanish (keep proper brand/product names as written).
- notes: one short sentence in Spanish stating the main assumption or uncertainty.`;

const PHOTO_PROMPT = `You help log food in a nutrition tracker. The attached image is EITHER a nutrition-facts label (any country/language, e.g. Spain, US, Japan) OR a photo of food / a meal / a product.

If it is a nutrition label: kind="label". Read the printed values exactly. If the label only gives values per serving/portion/package (US labels, Japanese "1袋当たり" etc.), convert to per 100 using the printed serving weight and set servingG to it. If both per-100 and per-serving columns exist, use the per-100 column and set servingG from the serving column. If only kJ is printed, kcal = kJ / 4.184. portionG = null. Never invent values that are not printed, other than these conversions.

If it is food or a dish: kind="estimate". Identify it and estimate typical composition per 100 g from standard food-composition data (BEDCA, USDA, 日本食品標準成分表), accounting for visible cooking method and oil. Estimate portionG = the weight in grams of what is shown on the plate. servingG = null.

${FORMAT}`;

const textPrompt = (desc: string) => `You help log food in a nutrition tracker. Estimate the nutrition of this food described by the user (it may be in Spanish, English or Japanese):

"""${desc.slice(0, 600)}"""

kind="estimate". Treat it as one food or one combined dish and give typical composition per 100 g from standard food-composition data (BEDCA, USDA, 日本食品標準成分表). If the description states a quantity (grams, units, a plate, a can…), set portionG to that amount in grams; otherwise set portionG to a typical single portion. servingG = a typical single portion in grams.

${FORMAT}`;

function clean(raw: unknown): AiFood {
  const r = (raw ?? {}) as Record<string, unknown>;
  const p = (r.per100 ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const opt = (v: unknown) => {
    const n = Number(v);
    return v !== null && Number.isFinite(n) && n > 0 ? n : null;
  };
  const per100 = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, Math.round(num(p[k]) * 100) / 100])) as unknown as Nutrients;
  return {
    kind: r.kind === 'label' ? 'label' : 'estimate',
    name: String(r.name ?? '').slice(0, 120),
    brand: r.brand ? String(r.brand).slice(0, 80) : null,
    unit: r.unit === 'ml' ? 'ml' : 'g',
    servingG: opt(r.servingG),
    portionG: opt(r.portionG),
    per100,
    notes: String(r.notes ?? '').slice(0, 300),
  };
}

export class AiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function explain(code: string): string {
  switch (code) {
    case 'not_granted': return 'No has permitido que esta app use Claude. Puedes cambiarlo en el menú de permisos del artifact.';
    case 'sampling_disabled': return 'Claude no está disponible para esta cuenta.';
    case 'rate_limited': return 'Has hecho muchas consultas seguidas o has llegado a tu límite de uso. Espera un poco y vuelve a intentarlo.';
    case 'image_rejected': return 'No se pudo usar esa imagen. Prueba con otra foto (JPEG o PNG).';
    case 'images_unavailable': return 'Esta vista no permite enviar imágenes a Claude. Usa «Describir» o introduce los valores a mano.';
    case 'invalid_json': return 'Claude no devolvió un resultado válido. Vuelve a intentarlo.';
    case 'refused': return 'Claude no pudo procesar esta entrada. Prueba con otra foto o descripción.';
    case 'session_expired': return 'Tu sesión ha caducado. Vuelve a iniciar sesión en Claude.';
    case 'cancelled': return 'Cancelado.';
    default: return 'No se pudo contactar con Claude. Vuelve a intentarlo.';
  }
}

async function run(prompt: string, images?: Blob[]): Promise<AiFood> {
  const s = await getSample();
  if (!s) throw new AiError('unavailable', 'La lectura con Claude solo funciona dentro de claude.ai.');
  try {
    return clean(await s.json(prompt, images ? { images } : undefined));
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'upstream_error';
    throw new AiError(code, explain(code));
  }
}

export const aiFromPhoto = (file: Blob) => run(PHOTO_PROMPT, [file]);
export const aiFromText = (desc: string) => run(textPrompt(desc));
