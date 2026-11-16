import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food, Meal } from '../types';
import { addEntry, saveFood, touchFood, uid, useStore } from '../store';
import { fmt, MEAL_LABEL } from '../lib/nutrients';
import { aiCapabilities, aiFromPhoto, aiFromText, type AiFood } from '../lib/ai';
import { SearchInput, Sheet, Thumb, useToast } from '../components/ui';
import { IconCamera, IconEdit, IconImage, IconSparkle, IconStar } from '../components/Icons';
import { FoodForm, type FoodDraft } from './FoodForm';
import { AmountForm } from './AmountForm';

type Notice = { kind: 'info' | 'warn' | 'err'; text: string };
type Step =
  | { k: 'home' }
  | { k: 'thinking'; image?: string; label: string }
  | { k: 'describe'; text?: string; notice?: Notice }
  | { k: 'form'; draft: FoodDraft; image?: string; notice?: Notice; portionG?: number }
  /** library: already saved · adhoc: log only, don't keep */
  | { k: 'amount'; food: Food; mode: 'library' | 'adhoc'; portionG?: number };

export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const aiToDraft = (a: AiFood): FoodDraft => ({
  name: a.name, brand: a.brand ?? undefined, unit: a.unit, servingG: a.servingG ?? undefined, per100: a.per100,
});

const aiNotice = (a: AiFood): Notice =>
  a.kind === 'label'
    ? { kind: 'info', text: `Claude ha leído la etiqueta.${a.notes ? ` ${a.notes}` : ''} Revisa los valores antes de guardar.` }
    : { kind: 'warn', text: `Estimación de Claude${a.portionG ? ` · ración ≈ ${Math.round(a.portionG)} ${a.unit}` : ''}.${a.notes ? ` ${a.notes}` : ''}` };

export function AddFlow(props: { date: string; meal: Meal; onClose: () => void }) {
  const toast = useToast();
  const [stack, setStack] = useState<Step[]>([{ k: 'home' }]);
  const [ai, setAi] = useState<{ text: boolean; images: boolean } | null>(null);
  const step = stack[stack.length - 1];
  const push = (s: Step) => setStack((st) => [...st, s]);
  const replace = (s: Step) => setStack((st) => [...st.slice(0, -1), s]);
  const back = stack.length > 1 ? () => { run.current++; setStack((st) => st.slice(0, -1)); } : undefined;
  // Bumped on navigation so a late AI answer doesn't overwrite a step the user already left.
  const run = useRef(0);

  useEffect(() => { void aiCapabilities().then(setAi); }, []);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file?: File) {
    if (!file) return;
    const image = URL.createObjectURL(file);
    const token = ++run.current;
    push({ k: 'thinking', image, label: 'Claude está leyendo la foto…' });
    try {
      const a = await aiFromPhoto(file);
      if (token !== run.current) return;
      replace({ k: 'form', draft: aiToDraft(a), image, notice: aiNotice(a), portionG: a.portionG ?? undefined });
    } catch (e) {
      if (token !== run.current) return;
      replace({ k: 'form', draft: {}, image, notice: { kind: 'err', text: (e as Error).message } });
    }
  }

  async function onDescribe(text: string) {
    const token = ++run.current;
    push({ k: 'thinking', label: 'Claude está estimando…' });
    try {
      const a = await aiFromText(text);
      if (token !== run.current) return;
      replace({ k: 'form', draft: aiToDraft(a), notice: aiNotice(a), portionG: a.portionG ?? undefined });
    } catch (e) {
      if (token !== run.current) return;
      replace({ k: 'describe', text, notice: { kind: 'err', text: (e as Error).message } });
    }
  }

  function log(food: Food, mode: 'library' | 'adhoc', amount: number, meal: Meal) {
    addEntry({
      id: uid(), date: props.date, meal, foodId: mode === 'adhoc' ? undefined : food.id, name: food.name,
      brand: food.brand, unit: food.unit, per100: food.per100, amount, createdAt: Date.now(),
    });
    if (mode === 'library') touchFood(food.id);
    toast(`Añadido a ${MEAL_LABEL[meal].toLowerCase()}`);
    props.onClose();
  }

  const title =
    step.k === 'home' ? `Añadir · ${MEAL_LABEL[props.meal]}` :
    step.k === 'thinking' ? 'Un momento' :
    step.k === 'describe' ? 'Describir comida' :
    step.k === 'form' ? 'Revisar alimento' : 'Cantidad';

  return (
    <Sheet title={title} onClose={() => { run.current++; props.onClose(); }} onBack={back} full>
      <input ref={cameraRef} id="photo-camera" className="hidden-input" type="file" accept="image/*" capture="environment"
        onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galleryRef} id="photo-gallery" className="hidden-input" type="file" accept="image/*"
        onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />

      {step.k === 'home' && (
        <Home
          ai={ai}
          onPhoto={() => cameraRef.current?.click()}
          onGallery={() => galleryRef.current?.click()}
          onDescribe={() => push({ k: 'describe' })}
          onManual={() => push({ k: 'form', draft: {} })}
          onPickFood={(f) => push({ k: 'amount', food: f, mode: 'library' })}
        />
      )}

      {step.k === 'thinking' && (
        <div className="stack-lg" style={{ paddingTop: 8 }}>
          {step.image && <img className="preview-img" src={step.image} alt="" />}
          <div className="row"><div className="spinner" /><span className="muted">{step.label}</span></div>
          <p className="muted small">Suele tardar entre 5 y 30 segundos. La primera vez, claude.ai te pedirá permiso para usar Claude desde esta app.</p>
        </div>
      )}

      {step.k === 'describe' && <Describe initial={step.text} notice={step.notice} onSubmit={(t) => void onDescribe(t)} />}

      {step.k === 'form' && (
        <FoodForm
          key={stack.length}
          draft={step.draft}
          image={step.image}
          notice={step.notice}
          submitLabel="Continuar"
          showLibraryToggle
          onSubmit={(food, keep) => {
            if (keep) saveFood(food);
            const portionG = step.portionG;
            // Drop the form (and a stale amount step if we came from "editar alimento").
            setStack((st) => [...st.slice(0, -1).filter((s) => s.k !== 'amount'), { k: 'amount', food, mode: keep ? 'library' : 'adhoc', portionG }]);
          }}
        />
      )}

      {step.k === 'amount' && (
        <AmountForm
          key={stack.length}
          food={step.food}
          amount={step.portionG ? Math.round(step.portionG) : undefined}
          meal={props.meal}
          submitLabel="Añadir"
          onSubmit={(amount, meal) => log(step.food, step.mode, amount, meal)}
          onEditFood={() => push({ k: 'form', draft: step.food, portionG: step.portionG })}
        />
      )}
    </Sheet>
  );
}

function Home(props: {
  ai: { text: boolean; images: boolean } | null;
  onPhoto: () => void; onGallery: () => void; onDescribe: () => void; onManual: () => void;
  onPickFood: (f: Food) => void;
}) {
  const { foods } = useStore();
  const [q, setQ] = useState('');
  const canPhoto = props.ai?.images ?? false;
  const canText = props.ai?.text ?? false;

  const list = useMemo(() => {
    const fq = fold(q.trim());
    const filtered = fq ? foods.filter((f) => fold(`${f.name} ${f.brand ?? ''}`).includes(fq)) : foods;
    return [...filtered].sort(
      (a, b) => Number(!!b.favorite) - Number(!!a.favorite) || (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt),
    ).slice(0, 40);
  }, [foods, q]);

  return (
    <div className="stack-lg">
      <div className="tiles">
        <button className="tile primary" onClick={props.onPhoto} disabled={!canPhoto}>
          <IconCamera size={22} /><span>Foto<br /><small>etiqueta o plato</small></span>
        </button>
        <button className="tile" onClick={props.onDescribe} disabled={!canText}>
          <IconSparkle size={22} /><span>Describir<br /><small>con palabras</small></span>
        </button>
        <button className="tile" onClick={props.onManual}>
          <IconEdit size={22} /><span>Manual<br /><small>valores a mano</small></span>
        </button>
      </div>
      {canPhoto && (
        <button className="link" style={{ alignSelf: 'flex-start', marginTop: -10 }} onClick={props.onGallery}>
          <IconImage size={14} style={{ verticalAlign: -2, marginRight: 4 }} />o elegir una foto de la galería
        </button>
      )}
      {props.ai && !canText && (
        <div className="notice">La lectura de fotos y descripciones con Claude solo funciona al abrir la app dentro de claude.ai.</div>
      )}

      <SearchInput value={q} onChange={setQ} placeholder="Buscar en mis alimentos" />

      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{q ? 'Resultados' : 'Recientes'}</div>
        {list.length === 0 && (
          <div className="empty">{q ? 'Sin resultados en tus alimentos.' : <>Aún no tienes alimentos guardados.<br />Haz una foto de tu primera etiqueta.</>}</div>
        )}
        {list.map((f) => (
          <button key={f.id} className="item" onClick={() => props.onPickFood(f)}>
            <Thumb name={f.name} />
            <div className="grow">
              <div className="ellipsis">{f.name} {f.favorite && <IconStar filled size={12} style={{ color: 'var(--carbs)', verticalAlign: -1 }} />}</div>
              <div className="meta ellipsis">{f.brand ? `${f.brand} · ` : ''}{fmt(f.per100.kcal, 'kcal')} kcal / 100 {f.unit}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const EXAMPLES = ['Un plato de lentejas con chorizo', '2 huevos fritos con aceite', 'Onigiri de atún mayonesa', 'Café con leche y 1 azúcar'];

function Describe(props: { initial?: string; notice?: Notice; onSubmit: (t: string) => void }) {
  const [text, setText] = useState(props.initial ?? '');
  return (
    <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); if (text.trim()) props.onSubmit(text.trim()); }}>
      <p className="muted small">Escribe qué has comido y, si lo sabes, la cantidad. Claude estimará los valores y podrás corregirlos.</p>
      <textarea id="describe-text" className="input textarea" rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)}
        placeholder="p. ej. 200 g de arroz con pollo al curry" />
      <div className="chips">
        {EXAMPLES.map((x) => <button type="button" key={x} className="chip" onClick={() => setText(x)}>{x}</button>)}
      </div>
      {props.notice && <div className={`notice ${props.notice.kind === 'info' ? '' : props.notice.kind}`}>{props.notice.text}</div>}
      <button className="btn primary block" type="submit" disabled={!text.trim()}>Estimar con Claude</button>
    </form>
  );
}
