/** Open Food Facts: free, open product database (barcode lookup + text search). */
import type { Nutrients } from '../types';

export interface OffProduct {
  barcode: string;
  name: string;
  brand?: string;
  servingG?: number;
  unit: 'g' | 'ml';
  per100: Nutrients;
  image?: string;
}

const FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_quantity,quantity,image_small_url';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(p: any): OffProduct | null {
  const n = p?.nutriments;
  if (!n) return null;
  const v = (k: string) => {
    const x = Number(n[`${k}_100g`]);
    return Number.isFinite(x) ? x : 0;
  };
  const kcal = v('energy-kcal') || (v('energy') ? v('energy') / 4.184 : 0);
  const name = p.product_name_es || p.product_name;
  if (!name) return null;
  return {
    barcode: String(p.code ?? ''),
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    servingG: Number(p.serving_quantity) || undefined,
    unit: /ml|cl|\bl\b/i.test(p.quantity ?? '') ? 'ml' : 'g',
    per100: {
      kcal: Math.round(kcal),
      protein: v('proteins'),
      carbs: v('carbohydrates'),
      sugar: v('sugars'),
      fat: v('fat'),
      satFat: v('saturated-fat'),
      fiber: v('fiber'),
      salt: v('salt'),
    },
    image: p.image_small_url,
  };
}

export async function offByBarcode(code: string): Promise<OffProduct | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!res.ok) return null;
  const j = await res.json();
  return j.status === 1 ? map(j.product) : null;
}

export async function offSearch(q: string, signal?: AbortSignal): Promise<OffProduct[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  const j = await res.json();
  return (j.products ?? []).map(map).filter(Boolean) as OffProduct[];
}

/** Native barcode detection (Chrome/Android, recent Safari). Returns null if unsupported or not found. */
export async function detectBarcode(file: Blob): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BD = (window as any).BarcodeDetector;
  if (!BD) return null;
  try {
    const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const bmp = await createImageBitmap(file);
    const codes = await det.detect(bmp);
    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

export const barcodeSupported = () => 'BarcodeDetector' in window;
