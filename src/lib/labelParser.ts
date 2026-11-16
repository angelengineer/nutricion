/**
 * Heuristic parser for OCR text of nutrition-facts labels.
 * Handles EU-style (per 100 g), US-style (per serving) and Japanese (…当たり) labels in
 * ES / EN / FR / DE / IT / PT / JA. OCR is noisy, so the result is always shown for review.
 */
import type { Nutrients, NutrientKey } from '../types';

export interface ParsedLabel {
  per100: Partial<Nutrients>;
  /** Values exactly as read, before basis conversion. */
  raw: Partial<Nutrients>;
  basis: 'per100' | 'perServing' | 'unknown';
  servingG?: number;
  found: number;
}

const NUM = String.raw`(<\s*)?(\d+(?:\.\d+)?)\s*(mg|g|kcal|kj|ml)?`;

// Order matters: more specific patterns (saturated, sugars) are tested before their parents.
const PATTERNS: [NutrientKey | 'sodium', RegExp][] = [
  ['satFat', /saturad|saturate|satur[ée]|ges[äa]ttigt|saturi|飽和脂肪酸/],
  ['sugar', /az[uú]car|\bsugars?\b|\bsucres?\b|zucker|zuccher|a[çc][uú]car|糖類/],
  ['fiber', /fibra|\bfib(?:er|re)|ballaststoff|食物繊維/],
  ['protein', /prote[ií]n|eiwei|たんぱく質|タンパク質|蛋白質/],
  ['carbs', /hidratos|carbohidrat|carbohydrat|glucide|kohlenhydrat|carboidrat|炭水化物|糖質/],
  ['fat', /grasa|\bfat\b|l[ií]pid|mati[eè]res? grasses|\bfett\b|grassi|gordura|脂質/],
  ['sodium', /sodio|sodium|natrium|s[óo]dio|ナトリウム/],
  ['salt', /\bsal\b|\bsalt\b|\bsel\b|\bsalz\b|\bsale\b|食塩/],
];

const CJK = String.raw`[　-鿿＀-￯]`;

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(new RegExp(`(${CJK})\\s+(?=${CJK})`, 'g'), '$1') // "エ ネ ル ギ ー" → "エネルギー"
    .replace(/(\d)\s*[,·]\s*(\d)/g, '$1.$2') // decimal comma
    .replace(/(\d)[oO](?=\D|$)/g, '$10') // "1O" → "10"
    .replace(/\b[oO](?=[.,]\d)/g, '0'); // "O.5" → "0.5"
}

function firstNumberAfter(line: string, from: number): { v: number; unit?: string } | null {
  const re = new RegExp(NUM, 'g');
  re.lastIndex = from;
  const m = re.exec(line);
  if (!m) return null;
  return { v: parseFloat(m[2]), unit: m[3] };
}

function parseEnergy(t: string): number | undefined {
  // "kJ/kcal 1550/370"
  let m = t.match(/kj\s*\/\s*kcal[^\d]{0,12}(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[2]);
  // "370 kcal"
  m = t.match(/(\d+(?:\.\d+)?)\s*kcal/);
  if (m) return parseFloat(m[1]);
  // "kcal 370" / "calories 230" / "エネルギー 250"
  m = t.match(/(?:kcal|calor[ií]as?|calories|エネルギー|熱量)[^\d\n]{0,15}(\d+(?:\.\d+)?)(?!\s*kj)/);
  if (m) return parseFloat(m[1]);
  // Only kJ available.
  m = t.match(/(\d+(?:\.\d+)?)\s*kj/);
  if (m) return Math.round(parseFloat(m[1]) / 4.184);
  return undefined;
}

function parseServing(t: string): number | undefined {
  const patterns = [
    /serving size[^\n]*?(\d+(?:\.\d+)?)\s*(?:g|ml)\b/,
    /(?:porci[oó]n|raci[oó]n|portion|porzione|por[çc][ãa]o)[^\n]{0,30}?(\d+(?:\.\d+)?)\s*(?:g|ml)\b/,
    /1\s*(?:食|袋|個|本|枚|杯|包装|パック|カップ|切れ|粒)[^\n]{0,6}?\(?\s*(\d+(?:\.\d+)?)\s*(?:g|ml)\)?/,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const v = parseFloat(m[1]);
      if (v > 0 && v !== 100) return v;
    }
  }
  return undefined;
}

function detectBasis(t: string): ParsedLabel['basis'] {
  if (/(?:per|por|pour|je|pro|para|para cada)\s*100\s*(?:g|ml)|100\s*(?:g|ml)\s*(?:あたり|当たり|当り)|\/\s*100\s*(?:g|ml)/.test(t))
    return 'per100';
  if (/serving|porci[oó]n|raci[oó]n|portion|1\s*(?:食|袋|個|本|枚|杯|包装|パック|カップ)/.test(t)) return 'perServing';
  return 'unknown';
}

export function parseLabel(input: string): ParsedLabel {
  const t = normalize(input);
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const raw: Partial<Nutrients> = {};
  let sodiumG: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [key, re] of PATTERNS) {
      const m = re.exec(line);
      if (!m) continue;
      if (key !== 'sodium' && raw[key] !== undefined) break;
      // Don't let "fat" capture a saturated/trans line or "carbs" capture a sugar line.
      if (key === 'fat' && /trans|トランス/.test(line)) break;
      let n = firstNumberAfter(line, m.index + m[0].length);
      // Table rows sometimes split: value on the next line.
      if (!n && lines[i + 1] && /^[<\d]/.test(lines[i + 1])) n = firstNumberAfter(lines[i + 1], 0);
      if (!n) break;
      const g = n.unit === 'mg' ? n.v / 1000 : n.v;
      if (key === 'sodium') sodiumG ??= g;
      else raw[key] = g;
      break;
    }
  }

  const kcal = parseEnergy(t);
  if (kcal !== undefined) raw.kcal = kcal;
  if (raw.salt === undefined && sodiumG !== undefined) raw.salt = Math.round(sodiumG * 2.5 * 100) / 100;

  const basis = detectBasis(t);
  const servingG = parseServing(t);
  const factor = basis === 'perServing' && servingG ? 100 / servingG : 1;
  const per100: Partial<Nutrients> = {};
  for (const [k, v] of Object.entries(raw) as [NutrientKey, number][]) {
    per100[k] = Math.round(v * factor * 100) / 100;
  }
  return { per100, raw, basis, servingG, found: Object.keys(raw).length };
}
