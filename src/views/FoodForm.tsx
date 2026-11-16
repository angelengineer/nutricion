import { useMemo, useState } from 'react';
import type { Food, Nutrients, NutrientKey } from '../types';
import { emptyNutrients, kcalFromMacros, NUTRIENT_KEYS, NUTRIENT_LABEL, NUTRIENT_UNIT } from '../lib/nutrients';
import { uid } from '../db';
import { NumInput, Segmented } from '../components/ui';

export type FoodDraft = Partial<Omit<Food, 'per100'>> & { per100?: Partial<Nutrients> };

const SUB: NutrientKey[] = ['sugar', 'satFat'];

/** Edit/confirm a food. Values can be typed per 100 g or per serving; they're always stored per 100. */
export function FoodForm(props: {
  draft: FoodDraft;
  image?: string;
  notice?: { kind: 'info' | 'warn' | 'err'; text: string };
  submitLabel: string;
  showLibraryToggle?: boolean;
  onSubmit: (food: Food, keepInLibrary: boolean) => void;
}) {
  const d = props.draft;
  const [name, setName] = useState(d.name ?? '');
  const [brand, setBrand] = useState(d.brand ?? '');
  const [unit, setUnit] = useState<'g' | 'ml'>(d.unit ?? 'g');
  const [servingG, setServingG] = useState<number | undefined>(d.servingG);
  const [basis, setBasis] = useState<'100' | 'serving'>('100');
  const [vals, setVals] = useState<Nutrients>({ ...emptyNutrients(), ...d.per100 });
  const [keep, setKeep] = useState(true);

  // Displayed values depend on basis; stored values are per 100.
  const factor = basis === 'serving' && servingG ? servingG / 100 : 1;
  const per100 = vals;

  const setVal = (k: NutrientKey, v: number) =>
    setVals((p) => ({ ...p, [k]: factor ? v / factor : v }));

  const check = useMemo(() => {
    const est = kcalFromMacros(per100);
    if (!per100.kcal || est < 20) return null;
    const dev = Math.abs(est - per100.kcal) / per100.kcal;
    return dev > 0.2 ? Math.round(est) : null;
  }, [per100]);

  const canSave = name.trim().length > 0 && (basis === '100' || !!servingG);

  const submit = () => {
    const now = Date.now();
    props.onSubmit(
      {
        id: d.id ?? uid(),
        createdAt: d.createdAt ?? now,
        updatedAt: now,
        name: name.trim(),
        brand: brand.trim() || undefined,
        barcode: d.barcode,
        unit,
        servingG: servingG || undefined,
        per100: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, Math.round((per100[k] || 0) * 100) / 100])) as unknown as Nutrients,
        favorite: d.favorite,
        lastUsedAt: d.lastUsedAt,
      },
      keep,
    );
  };

  return (
    <div className="stack-lg">
      {props.image && <img className="preview-img" src={props.image} alt="Etiqueta" />}
      {props.notice && <div className={`notice ${props.notice.kind === 'info' ? '' : props.notice.kind}`}>{props.notice.text}</div>}

      <div className="stack">
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Yogur griego natural" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Marca</span>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opcional" />
          </label>
          <label className="field">
            <span>Ración</span>
            <NumInput value={servingG} onChange={(v) => setServingG(v || undefined)} suffix={unit} placeholder="—" />
          </label>
        </div>
        <Segmented value={unit} onChange={setUnit} options={[{ value: 'g', label: 'Sólido (g)' }, { value: 'ml', label: 'Líquido (ml)' }]} />
      </div>

      <div className="card flat" style={{ padding: '10px 16px' }}>
        <div className="row between" style={{ padding: '4px 0 8px' }}>
          <span className="eyebrow">Valores</span>
          <div style={{ width: 190 }}>
            <Segmented
              value={basis}
              onChange={setBasis}
              options={[{ value: '100', label: `por 100 ${unit}` }, { value: 'serving', label: 'por ración' }]}
            />
          </div>
        </div>
        {basis === 'serving' && !servingG && (
          <div className="notice warn" style={{ marginBottom: 8 }}>Indica el tamaño de la ración para convertir.</div>
        )}
        <div className="nutri-table">
          {NUTRIENT_KEYS.map((k) => (
            <div key={k} className={`nutri-row ${SUB.includes(k) ? 'sub' : ''}`}>
              <label>{NUTRIENT_LABEL[k]}</label>
              <NumInput value={per100[k] * factor} onChange={(v) => setVal(k, v)} suffix={NUTRIENT_UNIT[k]} />
            </div>
          ))}
        </div>
      </div>

      {check !== null && (
        <div className="notice warn">
          Las calorías no cuadran con los macros (≈ {check} kcal estimadas por 100 {unit}). Revisa los valores.
        </div>
      )}

      {props.showLibraryToggle && (
        <label className="row small muted" style={{ gap: 8 }}>
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Guardar en mis alimentos
        </label>
      )}

      <button className="btn primary block" disabled={!canSave} onClick={submit}>
        {props.submitLabel}
      </button>
    </div>
  );
}
