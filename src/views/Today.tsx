import { useEffect, useState } from 'react';
import type { Entry, Goals, Meal } from '../types';
import { copyDay, deleteEntry, entriesFor, saveFood, updateEntry, useStore, watchDay } from '../store';
import { entryNutrients, fmt, MEALS, totals } from '../lib/nutrients';
import { addDays, humanDate, parseISODate, today } from '../lib/date';
import { MacroBar, Ring, Sheet, useToast } from '../components/ui';
import { IconCopy, IconLeft, IconPlus, IconRight } from '../components/Icons';
import { AmountForm } from './AmountForm';
import { FoodForm } from './FoodForm';

export function Today(props: { date: string; setDate: (d: string) => void; goals: Goals; onAdd: (m: Meal) => void }) {
  const { date, goals } = props;
  const toast = useToast();
  const store = useStore();
  const entries = store.ready ? entriesFor(store, date) : undefined;
  const prevCount = entriesFor(store, addDays(date, -1)).length;
  useEffect(() => watchDay(date), [date]);
  useEffect(() => watchDay(addDays(date, -1)), [date]);
  const [editing, setEditing] = useState<{ entry: Entry; editFood?: boolean } | null>(null);

  const t = totals(entries ?? []);
  const remaining = goals.kcal - t.kcal;
  const isToday = date === today();

  function copyPrevDay() {
    copyDay(addDays(date, -1), date);
    toast(`${prevCount} alimentos copiados`);
  }

  return (
    <div className="stack-lg">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            {parseISODate(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="title">{humanDate(date)}</h1>
        </div>
        <div className="date-nav">
          {!isToday && <button className="btn sm ghost" onClick={() => props.setDate(today())}>Hoy</button>}
          <button className="icon-btn" aria-label="Día anterior" onClick={() => props.setDate(addDays(date, -1))}><IconLeft /></button>
          <button className="icon-btn" aria-label="Día siguiente" onClick={() => props.setDate(addDays(date, 1))}><IconRight /></button>
        </div>
      </header>

      <section className="card">
        <div className="summary">
          <Ring value={t.kcal} goal={goals.kcal}>
            <span className={`big-num num ${remaining < 0 ? 'over' : ''}`}>{fmt(Math.abs(remaining), 'kcal')}</span>
            <span className="muted small">{remaining < 0 ? 'kcal de más' : 'kcal restantes'}</span>
          </Ring>
          <div className="stack">
            <div className="row between small">
              <span className="muted">Consumido</span>
              <span className="num" style={{ whiteSpace: 'nowrap' }}><b>{fmt(t.kcal, 'kcal')}</b><span className="muted"> / {fmt(goals.kcal, 'kcal')}</span></span>
            </div>
            <MacroBar label="Proteínas" value={t.protein} goal={goals.protein} color="var(--protein)" />
            <MacroBar label="Hidratos" value={t.carbs} goal={goals.carbs} color="var(--carbs)" />
            <MacroBar label="Grasas" value={t.fat} goal={goals.fat} color="var(--fat)" />
          </div>
        </div>
        <div className="minis">
          <div className="mini">
            <div className="v num">{fmt(t.fiber)}<span className="muted small"> / {goals.fiber} g</span></div>
            <div className="l">Fibra</div>
          </div>
          <div className="mini">
            <div className={`v num ${t.sugar > goals.sugar ? 'over' : ''}`}>{fmt(t.sugar)}<span className="muted small"> / {goals.sugar} g</span></div>
            <div className="l">Azúcares</div>
          </div>
          <div className="mini">
            <div className={`v num ${t.salt > goals.salt ? 'over' : ''}`}>{fmt(t.salt, 'salt')}<span className="muted small"> / {goals.salt} g</span></div>
            <div className="l">Sal</div>
          </div>
        </div>
      </section>

      {entries && entries.length === 0 && prevCount > 0 && (
        <button className="btn ghost block" onClick={copyPrevDay}>
          <IconCopy size={16} /> Copiar el día anterior ({prevCount})
        </button>
      )}

      {!entries && <div className="row" style={{ justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>}

      {entries && MEALS.map((m) => {
        const items = (entries ?? []).filter((e) => e.meal === m.key);
        const mt = totals(items);
        return (
          <section key={m.key} className="card">
            <div className="meal-head">
              <h2 className="h2">{m.label}</h2>
              {items.length > 0 && (
                <span className="small muted num">
                  {fmt(mt.kcal, 'kcal')} kcal · P {fmt(mt.protein)} · H {fmt(mt.carbs)} · G {fmt(mt.fat)}
                </span>
              )}
            </div>
            {items.map((e) => {
              const n = entryNutrients(e);
              return (
                <button key={e.id} className="item" onClick={() => setEditing({ entry: e })}>
                  <div className="grow">
                    <div className="ellipsis">{e.name}</div>
                    <div className="meta">
                      {fmt(e.amount)} {e.unit}
                      <span className="dots" style={{ marginLeft: 10 }}>
                        <span><i className="dot" style={{ background: 'var(--protein)' }} />{fmt(n.protein)}</span>
                        <span><i className="dot" style={{ background: 'var(--carbs)' }} />{fmt(n.carbs)}</span>
                        <span><i className="dot" style={{ background: 'var(--fat)' }} />{fmt(n.fat)}</span>
                      </span>
                    </div>
                  </div>
                  <span className="kcal num">{fmt(n.kcal, 'kcal')}</span>
                </button>
              );
            })}
            <button className="add-line" onClick={() => props.onAdd(m.key)}>
              <IconPlus size={16} /> Añadir
            </button>
          </section>
        );
      })}

      {editing && !editing.editFood && (
        <Sheet title="Editar" onClose={() => setEditing(null)}>
          <AmountForm
            food={editing.entry}
            amount={editing.entry.amount}
            meal={editing.entry.meal}
            submitLabel="Guardar"
            onSubmit={(amount, meal) => {
              updateEntry({ ...editing.entry, amount, meal });
              setEditing(null);
            }}
            onDelete={() => {
              deleteEntry(editing.entry.date, editing.entry.id);
              setEditing(null);
              toast('Eliminado');
            }}
            onEditFood={() => setEditing({ ...editing, editFood: true })}
          />
        </Sheet>
      )}

      {editing?.editFood && (
        <Sheet title="Corregir valores" onClose={() => setEditing(null)} onBack={() => setEditing({ entry: editing.entry })}>
          <FoodForm
            draft={{ ...editing.entry, id: editing.entry.foodId, servingG: undefined }}
            submitLabel="Guardar"
            onSubmit={(food) => {
              const e = { ...editing.entry, name: food.name, brand: food.brand, unit: food.unit, per100: food.per100 };
              updateEntry(e);
              // Also fix the library food so future logs are correct.
              const lib = e.foodId ? store.foods.find((f) => f.id === e.foodId) : undefined;
              if (lib) saveFood({ ...lib, name: food.name, brand: food.brand, unit: food.unit, per100: food.per100 });
              setEditing({ entry: e });
            }}
          />
        </Sheet>
      )}
    </div>
  );
}
