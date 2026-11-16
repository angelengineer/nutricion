import { useMemo, useState } from 'react';
import type { Food } from '../types';
import { deleteFood, saveFood, useStore } from '../store';
import { fmt } from '../lib/nutrients';
import { SearchInput, Sheet, Thumb, useToast } from '../components/ui';
import { IconPlus, IconStar, IconTrash } from '../components/Icons';
import { FoodForm } from './FoodForm';
import { fold } from './AddFlow';

export function Foods() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Food> | null>(null);
  const { foods } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list = useMemo(() => {
    const fq = fold(q.trim());
    return foods
      .filter((f) => !fq || fold(`${f.name} ${f.brand ?? ''}`).includes(fq))
      .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.name.localeCompare(b.name, 'es'));
  }, [foods, q]);

  return (
    <div className="stack-lg">
      <header className="topbar">
        <div>
          <div className="eyebrow">{foods.length} guardados</div>
          <h1 className="title">Alimentos</h1>
        </div>
        <button className="btn sm" onClick={() => setEditing({})}><IconPlus size={16} /> Nuevo</button>
      </header>

      <SearchInput value={q} onChange={setQ} placeholder="Buscar" />

      <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {list.length === 0 && <div className="empty">{q ? 'Sin resultados.' : 'Los alimentos que escanees o crees aparecerán aquí.'}</div>}
        {list.map((f) => (
          <div key={f.id} className="item">
            <Thumb name={f.name} />
            <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => { setConfirmDelete(false); setEditing(f); }}>
              <div className="ellipsis">{f.name}</div>
              <div className="meta ellipsis num">
                {f.brand ? `${f.brand} · ` : ''}{fmt(f.per100.kcal, 'kcal')} kcal · P {fmt(f.per100.protein)} · H {fmt(f.per100.carbs)} · G {fmt(f.per100.fat)}
              </div>
            </button>
            <button className="icon-btn" aria-label="Favorito" onClick={() => saveFood({ ...f, favorite: !f.favorite })}
              style={{ color: f.favorite ? 'var(--carbs)' : undefined }}>
              <IconStar size={18} filled={f.favorite} />
            </button>
          </div>
        ))}
      </section>

      {editing && (
        <Sheet title={editing.id ? 'Editar alimento' : 'Nuevo alimento'} onClose={() => setEditing(null)} full>
          <FoodForm
            draft={editing}
            submitLabel="Guardar"
            onSubmit={(food) => {
              saveFood(food);
              setEditing(null);
              toast('Guardado');
            }}
          />
          {editing.id && !confirmDelete && (
            <button className="btn danger block" style={{ marginTop: 12 }} onClick={() => setConfirmDelete(true)}>
              <IconTrash size={16} /> Eliminar alimento
            </button>
          )}
          {editing.id && confirmDelete && (
            <div className="notice err stack" style={{ marginTop: 12 }}>
              <span>¿Eliminar «{editing.name}»? Tu historial no cambia.</span>
              <div className="row">
                <button className="btn sm ghost grow" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                <button className="btn sm grow" style={{ background: 'var(--over)', color: '#fff' }} onClick={() => {
                  deleteFood(editing.id!);
                  setEditing(null);
                  toast('Eliminado');
                }}>Eliminar</button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
