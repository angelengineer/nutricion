import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Food, Meal } from '../types';
import { alive, db, saveEntry, saveFood, touchFood, uid } from '../db';
import { fmt, MEAL_LABEL } from '../lib/nutrients';
import { geminiLabel, hasGemini } from '../lib/gemini';
import { ocrLabel } from '../lib/ocr';
import { barcodeSupported, detectBarcode, offByBarcode, offSearch, type OffProduct } from '../lib/off';
import { SearchInput, Sheet, Thumb, useToast } from '../components/ui';
import { IconBarcode, IconCamera, IconEdit, IconImage, IconStar } from '../components/Icons';
import { FoodForm, type FoodDraft } from './FoodForm';
import { AmountForm } from './AmountForm';

type Notice = { kind: 'info' | 'warn' | 'err'; text: string };
type Step =
  | { k: 'home' }
  | { k: 'scanning'; image: string; progress: number; label: string }
  | { k: 'form'; draft: FoodDraft; image?: string; notice?: Notice }
  /** library: already saved · new: save on log · adhoc: log only, don't keep */
  | { k: 'amount'; food: Food; mode: 'library' | 'new' | 'adhoc' }
  | { k: 'barcode'; notice?: Notice; busy?: boolean };

export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const offToDraft = (p: OffProduct): FoodDraft => ({
  name: p.name, brand: p.brand, barcode: p.barcode || undefined, servingG: p.servingG, unit: p.unit, per100: p.per100,
});

const draftToFood = (d: FoodDraft): Food => {
  const now = Date.now();
  return {
    id: uid(), createdAt: now, updatedAt: now, name: d.name ?? '', brand: d.brand, barcode: d.barcode,
    unit: d.unit ?? 'g', servingG: d.servingG, per100: { kcal: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, satFat: 0, fiber: 0, salt: 0, ...d.per100 },
  };
};

export function AddFlow(props: { date: string; meal: Meal; onClose: () => void }) {
  const toast = useToast();
  const [stack, setStack] = useState<Step[]>([{ k: 'home' }]);
  const step = stack[stack.length - 1];
  const push = (s: Step) => setStack((st) => [...st, s]);
  const replace = (s: Step) => setStack((st) => [...st.slice(0, -1), s]);
  const back = stack.length > 1 ? () => setStack((st) => st.slice(0, -1)) : undefined;

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // ---- label scan ----
  async function onLabelPhoto(file?: File) {
    if (!file) return;
    const image = URL.createObjectURL(file);
    const useGemini = hasGemini();
    push({ k: 'scanning', image, progress: 0, label: useGemini ? 'Leyendo etiqueta con Gemini…' : 'Reconociendo texto…' });
    let draft: FoodDraft | null = null;
    let notice: Notice | undefined;
    if (useGemini) {
      try {
        const g = await geminiLabel(file);
        draft = { name: g.name ?? '', brand: g.brand ?? undefined, servingG: g.servingG ?? undefined, unit: g.unit, per100: g.per100 };
        notice = { kind: 'info', text: 'Leído con Gemini. Revisa los valores antes de guardar.' };
      } catch (e) {
        notice = { kind: 'warn', text: `Gemini falló (${(e as Error).message}). Se usó OCR local.` };
        replace({ k: 'scanning', image, progress: 0, label: 'Reconociendo texto…' });
      }
    }
    if (!draft) {
      try {
        const r = await ocrLabel(file, (p) => replace({ k: 'scanning', image, progress: p, label: 'Reconociendo texto…' }));
        draft = { per100: r.per100, servingG: r.servingG };
        const basis = r.basis === 'perServing' && r.servingG ? ` Convertido de ración (${r.servingG} g) a 100 g.` : '';
        notice =
          r.found >= 4
            ? notice ?? { kind: 'info', text: `Detectados ${r.found} valores.${basis} Revisa antes de guardar.` }
            : { kind: 'err', text: `Solo se leyeron ${r.found} valores. Prueba con una foto más cercana y plana, o completa a mano.${hasGemini() ? '' : ' Para mayor precisión activa Gemini en Ajustes.'}` };
      } catch (e) {
        draft = {};
        notice = { kind: 'err', text: `No se pudo leer la imagen: ${(e as Error).message}` };
      }
    }
    replace({ k: 'form', draft, image, notice });
  }

  // ---- barcode ----
  async function lookupBarcode(code: string) {
    code = code.replace(/\D/g, '');
    if (code.length < 6) return;
    replace({ k: 'barcode', busy: true });
    const local = (await db.foods.where('barcode').equals(code).toArray()).find(alive);
    if (local) return replace({ k: 'amount', food: local, mode: 'library' });
    try {
      const p = await offByBarcode(code);
      if (p) return replace({ k: 'form', draft: offToDraft(p), image: p.image, notice: { kind: 'info', text: 'Datos de Open Food Facts. Revísalos.' } });
      replace({ k: 'barcode', notice: { kind: 'warn', text: `No se encontró ${code}. Escanea la etiqueta nutricional.` } });
    } catch {
      replace({ k: 'barcode', notice: { kind: 'err', text: 'Sin conexión con Open Food Facts.' } });
    }
  }

  async function onBarcodePhoto(file?: File) {
    if (!file) return;
    replace({ k: 'barcode', busy: true });
    const code = await detectBarcode(file);
    if (code) await lookupBarcode(code);
    else replace({ k: 'barcode', notice: { kind: 'warn', text: 'No se detectó ningún código. Escríbelo a mano.' } });
  }

  // ---- logging ----
  async function addEntry(food: Food, mode: 'library' | 'new' | 'adhoc', amount: number, meal: Meal) {
    if (mode === 'new') await saveFood(food);
    const now = Date.now();
    await saveEntry({
      id: uid(), date: props.date, meal, foodId: mode === 'adhoc' ? undefined : food.id, name: food.name, brand: food.brand,
      unit: food.unit, per100: food.per100, amount, createdAt: now, updatedAt: now,
    });
    if (mode !== 'adhoc') await touchFood(food.id);
    toast(`Añadido a ${MEAL_LABEL[meal].toLowerCase()}`);
    props.onClose();
  }

  const title =
    step.k === 'home' ? `Añadir · ${MEAL_LABEL[props.meal]}` :
    step.k === 'scanning' ? 'Escaneando' :
    step.k === 'form' ? 'Revisar alimento' :
    step.k === 'barcode' ? 'Código de barras' : 'Cantidad';

  return (
    <Sheet title={title} onClose={props.onClose} onBack={back} full>
      <input ref={cameraRef} className="hidden-input" type="file" accept="image/*" capture="environment"
        onChange={(e) => { void onLabelPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galleryRef} className="hidden-input" type="file" accept="image/*"
        onChange={(e) => { void onLabelPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={barcodeRef} className="hidden-input" type="file" accept="image/*" capture="environment"
        onChange={(e) => { void onBarcodePhoto(e.target.files?.[0]); e.target.value = ''; }} />

      {step.k === 'home' && (
        <Home
          onScan={() => cameraRef.current?.click()}
          onGallery={() => galleryRef.current?.click()}
          onBarcode={() => push({ k: 'barcode' })}
          onManual={() => push({ k: 'form', draft: {} })}
          onPickFood={(f) => push({ k: 'amount', food: f, mode: 'library' })}
          onPickOff={(p) => push({ k: 'amount', food: draftToFood(offToDraft(p)), mode: 'new' })}
        />
      )}

      {step.k === 'scanning' && (
        <div className="stack-lg" style={{ paddingTop: 8 }}>
          <img className="preview-img" src={step.image} alt="" />
          <div className="row"><div className="spinner" /><span className="muted">{step.label}</span></div>
          {step.progress > 0 && <div className="progress"><i style={{ width: `${step.progress * 100}%` }} /></div>}
          <p className="muted small">La primera vez se descargan los datos de idioma del OCR; después funciona sin conexión.</p>
        </div>
      )}

      {step.k === 'form' && (
        <FoodForm
          key={stack.length}
          draft={step.draft}
          image={step.image}
          notice={step.notice}
          submitLabel="Continuar"
          showLibraryToggle
          onSubmit={async (food, keep) => {
            if (keep) await saveFood(food);
            // Drop the form (and a stale amount step if we came from "editar alimento").
            setStack((st) => [...st.slice(0, -1).filter((s) => s.k !== 'amount'), { k: 'amount', food, mode: keep ? 'library' : 'adhoc' }]);
          }}
        />
      )}

      {step.k === 'amount' && (
        <AmountForm
          key={stack.length}
          food={step.food}
          meal={props.meal}
          submitLabel="Añadir"
          onSubmit={(amount, meal) => void addEntry(step.food, step.mode, amount, meal)}
          onEditFood={() => push({ k: 'form', draft: step.food })}
        />
      )}

      {step.k === 'barcode' && (
        <BarcodeStep
          busy={step.busy}
          notice={step.notice}
          onPhoto={() => barcodeRef.current?.click()}
          onCode={(c) => void lookupBarcode(c)}
          onScanLabel={() => cameraRef.current?.click()}
        />
      )}
    </Sheet>
  );
}

function Home(props: {
  onScan: () => void; onGallery: () => void; onBarcode: () => void; onManual: () => void;
  onPickFood: (f: Food) => void; onPickOff: (p: OffProduct) => void;
}) {
  const [q, setQ] = useState('');
  const [off, setOff] = useState<{ q: string; loading: boolean; items: OffProduct[]; error?: string } | null>(null);
  const foods = useLiveQuery(() => db.foods.filter(alive).toArray(), []) ?? [];

  const list = useMemo(() => {
    const fq = fold(q.trim());
    const filtered = fq ? foods.filter((f) => fold(`${f.name} ${f.brand ?? ''}`).includes(fq)) : foods;
    return [...filtered].sort(
      (a, b) => Number(!!b.favorite) - Number(!!a.favorite) || (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt),
    ).slice(0, 40);
  }, [foods, q]);

  useEffect(() => setOff(null), [q]);

  async function searchOff() {
    const query = q.trim();
    setOff({ q: query, loading: true, items: [] });
    try {
      setOff({ q: query, loading: false, items: await offSearch(query) });
    } catch (e) {
      setOff({ q: query, loading: false, items: [], error: (e as Error).message });
    }
  }

  return (
    <div className="stack-lg">
      <div className="tiles">
        <button className="tile primary" onClick={props.onScan}><IconCamera size={22} />Foto etiqueta</button>
        <button className="tile" onClick={props.onBarcode}><IconBarcode size={22} />Código</button>
        <button className="tile" onClick={props.onManual}><IconEdit size={22} />Manual</button>
      </div>
      <button className="link" style={{ alignSelf: 'flex-start', marginTop: -10 }} onClick={props.onGallery}>
        <IconImage size={14} style={{ verticalAlign: -2, marginRight: 4 }} />o elegir foto de la galería
      </button>

      <SearchInput value={q} onChange={setQ} placeholder="Buscar en mis alimentos" />

      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{q ? 'Resultados' : 'Recientes'}</div>
        {list.length === 0 && !q && <div className="empty">Aún no tienes alimentos guardados.<br />Escanea tu primera etiqueta.</div>}
        {list.map((f) => (
          <button key={f.id} className="item" onClick={() => props.onPickFood(f)}>
            <Thumb name={f.name} />
            <div className="grow">
              <div className="ellipsis">{f.name} {f.favorite && <IconStar filled size={12} style={{ color: 'var(--carbs)', verticalAlign: -1 }} />}</div>
              <div className="meta ellipsis">{f.brand ? `${f.brand} · ` : ''}{fmt(f.per100.kcal, 'kcal')} kcal / 100 {f.unit}</div>
            </div>
          </button>
        ))}
        {q.trim().length >= 2 && !off && (
          <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => void searchOff()}>
            Buscar «{q.trim()}» en Open Food Facts
          </button>
        )}
      </div>

      {off && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Open Food Facts</div>
          {off.loading && <div className="row" style={{ padding: 16 }}><div className="spinner" /></div>}
          {off.error && <div className="notice err">{off.error}</div>}
          {!off.loading && !off.error && off.items.length === 0 && <div className="empty">Sin resultados.</div>}
          {off.items.map((p, i) => (
            <button key={`${p.barcode}-${i}`} className="item" onClick={() => props.onPickOff(p)}>
              <Thumb name={p.name} src={p.image} />
              <div className="grow">
                <div className="ellipsis">{p.name}</div>
                <div className="meta ellipsis">{p.brand ? `${p.brand} · ` : ''}{fmt(p.per100.kcal, 'kcal')} kcal · P {fmt(p.per100.protein)} · H {fmt(p.per100.carbs)} · G {fmt(p.per100.fat)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BarcodeStep(props: { busy?: boolean; notice?: Notice; onPhoto: () => void; onCode: (c: string) => void; onScanLabel: () => void }) {
  const [code, setCode] = useState('');
  return (
    <div className="stack-lg">
      {barcodeSupported() ? (
        <button className="btn primary block" onClick={props.onPhoto} disabled={props.busy}>
          <IconBarcode size={18} /> Foto del código de barras
        </button>
      ) : (
        <div className="notice">Este navegador no detecta códigos automáticamente. Escribe los números bajo el código.</div>
      )}
      <form className="row" onSubmit={(e) => { e.preventDefault(); props.onCode(code); }}>
        <input className="input grow" inputMode="numeric" placeholder="8410000000000" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn" type="submit" disabled={props.busy || code.replace(/\D/g, '').length < 6}>Buscar</button>
      </form>
      {props.busy && <div className="row"><div className="spinner" /><span className="muted">Buscando…</span></div>}
      {props.notice && (
        <div className={`notice ${props.notice.kind === 'info' ? '' : props.notice.kind}`}>
          {props.notice.text}
          {props.notice.kind === 'warn' && (
            <div style={{ marginTop: 8 }}><button className="btn sm" onClick={props.onScanLabel}><IconCamera size={16} /> Escanear etiqueta</button></div>
          )}
        </div>
      )}
    </div>
  );
}
