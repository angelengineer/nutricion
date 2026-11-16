import { useState } from 'react';
import type { Meal, Nutrients } from '../types';
import { fmt, MEALS, scale } from '../lib/nutrients';
import { NumInput } from '../components/ui';
import { IconTrash } from '../components/Icons';

export interface Portionable {
  name: string;
  brand?: string;
  unit: 'g' | 'ml';
  per100: Nutrients;
  servingG?: number;
}

export function AmountForm(props: {
  food: Portionable;
  amount?: number;
  meal: Meal;
  submitLabel: string;
  onSubmit: (amount: number, meal: Meal) => void;
  onDelete?: () => void;
  onEditFood?: () => void;
}) {
  const f = props.food;
  const [amount, setAmount] = useState(props.amount ?? f.servingG ?? 100);
  const [meal, setMeal] = useState<Meal>(props.meal);
  const n = scale(f.per100, amount);

  const presets = Array.from(
    new Set([...(f.servingG ? [f.servingG, f.servingG * 2] : []), 50, 100, 150, 200].map((x) => Math.round(x))),
  ).slice(0, 6);

  return (
    <div className="stack-lg">
      <div>
        <div className="h2">{f.name}</div>
        <div className="muted small">
          {f.brand ? `${f.brand} · ` : ''}
          {fmt(f.per100.kcal, 'kcal')} kcal / 100 {f.unit}
          {props.onEditFood && (
            <>
              {' · '}
              <button className="link" onClick={props.onEditFood}>editar alimento</button>
            </>
          )}
        </div>
      </div>

      <div className="stack">
        <NumInput value={amount} onChange={setAmount} suffix={f.unit} className="lg" autoFocus />
        <div className="chips">
          {presets.map((p) => (
            <button key={p} className={`chip ${p === amount ? 'active' : ''}`} onClick={() => setAmount(p)}>
              {f.servingG && p === Math.round(f.servingG) ? `1 ración · ${p}` : f.servingG && p === Math.round(f.servingG * 2) ? `2 raciones · ${p}` : p} {f.unit}
            </button>
          ))}
        </div>
      </div>

      <div className="card flat">
        <div className="row between">
          <div className="stat"><span className="v num">{fmt(n.kcal, 'kcal')}</span><span className="l">kcal</span></div>
          <div className="stat"><span className="v num" style={{ color: 'var(--protein)' }}>{fmt(n.protein)}</span><span className="l">Prot</span></div>
          <div className="stat"><span className="v num" style={{ color: 'var(--carbs)' }}>{fmt(n.carbs)}</span><span className="l">Hidr</span></div>
          <div className="stat"><span className="v num" style={{ color: 'var(--fat)' }}>{fmt(n.fat)}</span><span className="l">Grasa</span></div>
        </div>
      </div>

      <div className="chips">
        {MEALS.map((m) => (
          <button key={m.key} className={`chip ${m.key === meal ? 'active' : ''}`} onClick={() => setMeal(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="row">
        {props.onDelete && (
          <button className="btn danger" onClick={props.onDelete} aria-label="Eliminar"><IconTrash size={18} /></button>
        )}
        <button className="btn primary grow" disabled={!(amount > 0)} onClick={() => props.onSubmit(amount, meal)}>
          {props.submitLabel}
        </button>
      </div>
    </div>
  );
}
