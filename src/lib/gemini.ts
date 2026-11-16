/**
 * Label extraction with Google Gemini (free tier via an AI Studio API key).
 * Far more robust than OCR on curved, glossy or multi-column labels and in any language.
 */
import type { Nutrients } from '../types';
import { canvasToBase64Jpeg, fileToCanvas } from './image';
import { DEFAULT_GEMINI_MODEL, KEYS, lsGet } from './local';

export interface GeminiLabel {
  name: string | null;
  brand: string | null;
  servingG: number | null;
  unit: 'g' | 'ml';
  per100: Nutrients;
}

const num = { type: 'NUMBER' };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true, description: 'Product name in Spanish if visible or inferable, else null' },
    brand: { type: 'STRING', nullable: true },
    servingG: { type: 'NUMBER', nullable: true, description: 'Serving size in g or ml if stated' },
    unit: { type: 'STRING', enum: ['g', 'ml'] },
    per100: {
      type: 'OBJECT',
      properties: { kcal: num, protein: num, carbs: num, sugar: num, fat: num, satFat: num, fiber: num, salt: num },
      required: ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satFat', 'fiber', 'salt'],
    },
  },
  required: ['name', 'brand', 'servingG', 'unit', 'per100'],
};

const PROMPT = `You read nutrition-facts labels from photos.
Return values PER 100 g (or 100 ml for liquids).
- If the label only gives values per serving/portion/package (e.g. US labels, Japanese "1袋当たり"), convert to per 100 using the stated serving weight.
- kcal: energy in kilocalories (convert from kJ ÷ 4.184 if only kJ is given).
- carbs: total carbohydrates as printed (EU "hidratos de carbono", JP 炭水化物; if only 糖質 and 食物繊維 are given, carbs = 糖質).
- salt in grams; if only sodium is given, salt = sodium × 2.5 (convert mg → g).
- Use 0 for nutrients that are absent. Never invent values that are not on the label except these conversions.`;

export const hasGemini = () => Boolean(lsGet(KEYS.geminiKey));

export async function geminiLabel(file: Blob): Promise<GeminiLabel> {
  const key = lsGet(KEYS.geminiKey);
  if (!key) throw new Error('Falta la API key de Gemini (Ajustes).');
  const model = lsGet(KEYS.geminiModel, DEFAULT_GEMINI_MODEL);
  const data = canvasToBase64Jpeg(await fileToCanvas(file, 1600));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Gemini ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
  const json = await res.json();
  const text: string | undefined = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) throw new Error('Gemini no devolvió resultado.');
  return JSON.parse(text) as GeminiLabel;
}
