import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Goals, Profile } from '../types';
import { exportAll, getProfile, mergeSnapshot, setSetting } from '../db';
import { DEFAULT_GOALS, suggestGoals } from '../lib/nutrients';
import { DEFAULT_GEMINI_MODEL, KEYS, lsGet, lsSet } from '../lib/local';
import { disconnectSync, getSyncStatus, onSyncStatus, syncNow, type SyncStatus } from '../lib/sync';
import { NumInput, Segmented, useToast } from '../components/ui';
import { IconSync } from '../components/Icons';

export function Settings({ goals }: { goals: Goals }) {
  return (
    <div className="stack-lg">
      <header className="topbar">
        <div>
          <div className="eyebrow">Configuración</div>
          <h1 className="title">Ajustes</h1>
        </div>
      </header>
      <GoalsCard goals={goals} />
      <ScanCard />
      <SyncCard />
      <DataCard />
      <p className="small muted" style={{ textAlign: 'center' }}>
        Tus datos se guardan en este dispositivo. Código abierto ·{' '}
        <a href="https://github.com/angelengineer/nutricion" target="_blank" rel="noreferrer">GitHub</a>
      </p>
    </div>
  );
}

const GOAL_FIELDS: { k: keyof Goals; l: string; u: string }[] = [
  { k: 'kcal', l: 'Calorías', u: 'kcal' },
  { k: 'protein', l: 'Proteínas', u: 'g' },
  { k: 'carbs', l: 'Hidratos', u: 'g' },
  { k: 'fat', l: 'Grasas', u: 'g' },
  { k: 'fiber', l: 'Fibra (mín.)', u: 'g' },
  { k: 'sugar', l: 'Azúcares (máx.)', u: 'g' },
  { k: 'salt', l: 'Sal (máx.)', u: 'g' },
];

const ACTIVITY = [
  { value: 1.2, label: 'Sedentario' },
  { value: 1.375, label: 'Ligero' },
  { value: 1.55, label: 'Moderado' },
  { value: 1.725, label: 'Alto' },
];

function GoalsCard({ goals }: { goals: Goals }) {
  const toast = useToast();
  const [g, setG] = useState<Goals>(goals);
  const [calc, setCalc] = useState(false);
  useEffect(() => setG(goals), [goals]);
  const macroKcal = g.protein * 4 + g.carbs * 4 + g.fat * 9;
  const dirty = JSON.stringify(g) !== JSON.stringify(goals);

  return (
    <section className="card">
      <div className="card-title">
        <span className="h2">Objetivos diarios</span>
        <button className="link" onClick={() => setCalc((c) => !c)}>{calc ? 'cerrar' : 'calcular'}</button>
      </div>
      {calc && <Calculator onApply={(s) => { setG(s); setCalc(false); }} />}
      <div className="nutri-table">
        {GOAL_FIELDS.map((f) => (
          <div key={f.k} className="nutri-row">
            <label>{f.l}</label>
            <NumInput value={g[f.k]} onChange={(v) => setG({ ...g, [f.k]: v })} suffix={f.u} />
          </div>
        ))}
      </div>
      <p className={`small ${Math.abs(macroKcal - g.kcal) > g.kcal * 0.05 ? 'over' : 'muted'}`} style={{ margin: '10px 0' }}>
        Macros = {Math.round(macroKcal)} kcal ({g.kcal ? Math.round((macroKcal / g.kcal) * 100) : 0}% del objetivo)
      </p>
      <div className="row">
        <button className="btn ghost sm" onClick={() => setG(DEFAULT_GOALS)}>Restablecer</button>
        <button className="btn primary sm grow" disabled={!dirty} onClick={async () => { await setSetting('goals', g); toast('Objetivos guardados'); }}>
          Guardar objetivos
        </button>
      </div>
    </section>
  );
}

function Calculator({ onApply }: { onApply: (g: Goals) => void }) {
  const saved = useLiveQuery(() => getProfile(), []);
  const [p, setP] = useState<Profile>({ sex: 'male', age: 25, heightCm: 175, weightKg: 70, activity: 1.55, objective: 'maintain' });
  useEffect(() => { if (saved) setP(saved); }, [saved]);
  const s = suggestGoals(p);
  return (
    <div className="stack" style={{ padding: '4px 0 16px', marginBottom: 12, borderBottom: '1px solid var(--line)' }}>
      <Segmented value={p.sex} onChange={(sex) => setP({ ...p, sex })} options={[{ value: 'male', label: 'Hombre' }, { value: 'female', label: 'Mujer' }]} />
      <div className="grid-3">
        <label className="field"><span>Edad</span><NumInput value={p.age} onChange={(age) => setP({ ...p, age })} /></label>
        <label className="field"><span>Altura</span><NumInput value={p.heightCm} onChange={(heightCm) => setP({ ...p, heightCm })} suffix="cm" /></label>
        <label className="field"><span>Peso</span><NumInput value={p.weightKg} onChange={(weightKg) => setP({ ...p, weightKg })} suffix="kg" /></label>
      </div>
      <div className="chips">
        {ACTIVITY.map((a) => (
          <button key={a.value} className={`chip ${p.activity === a.value ? 'active' : ''}`} onClick={() => setP({ ...p, activity: a.value })}>{a.label}</button>
        ))}
      </div>
      <Segmented value={p.objective} onChange={(objective) => setP({ ...p, objective })}
        options={[{ value: 'lose', label: 'Perder grasa' }, { value: 'maintain', label: 'Mantener' }, { value: 'gain', label: 'Ganar músculo' }]} />
      <div className="notice num">
        {s.kcal} kcal · P {s.protein} g · H {s.carbs} g · G {s.fat} g
        <div className="small" style={{ marginTop: 4 }}>Mifflin–St Jeor × actividad{p.objective === 'lose' ? ' − 20 %' : p.objective === 'gain' ? ' + 10 %' : ''}. Proteína por kg de peso, grasa 27 % de la energía.</div>
      </div>
      <button className="btn sm" onClick={async () => { await setSetting('profile', p); onApply(s); }}>Usar estos valores</button>
    </div>
  );
}

function ScanCard() {
  const toast = useToast();
  const [key, setKey] = useState(lsGet(KEYS.geminiKey));
  const [model, setModel] = useState(lsGet(KEYS.geminiModel, DEFAULT_GEMINI_MODEL));
  const [lang, setLang] = useState(lsGet(KEYS.ocrLang, 'spa+eng'));
  return (
    <section className="card">
      <div className="card-title"><span className="h2">Lectura de etiquetas</span></div>
      <div className="stack">
        <p className="small muted">
          Sin configurar, las fotos se leen con OCR en el propio dispositivo. Con una API key gratuita de Gemini la lectura es mucho más precisa
          (etiquetas curvas, tablas, cualquier idioma). Consíguela en{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.
        </p>
        <label className="field">
          <span>API key de Gemini</span>
          <input className="input" type="password" autoComplete="off" value={key} placeholder="AIza…" onChange={(e) => setKey(e.target.value.trim())} />
        </label>
        <label className="field">
          <span>Modelo</span>
          <input className="input" value={model} onChange={(e) => setModel(e.target.value.trim())} />
        </label>
        <label className="field">
          <span>Idioma del OCR local</span>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="spa+eng">Español + inglés</option>
            <option value="jpn+eng">Japonés + inglés</option>
            <option value="eng">Inglés</option>
            <option value="fra+eng">Francés + inglés</option>
            <option value="deu+eng">Alemán + inglés</option>
            <option value="ita+eng">Italiano + inglés</option>
          </select>
        </label>
        <button className="btn primary sm" onClick={() => {
          lsSet(KEYS.geminiKey, key);
          lsSet(KEYS.geminiModel, model === DEFAULT_GEMINI_MODEL ? '' : model);
          lsSet(KEYS.ocrLang, lang);
          toast('Guardado');
        }}>Guardar</button>
        <p className="small muted">La clave se guarda solo en este dispositivo y no se sincroniza.</p>
      </div>
    </section>
  );
}

function SyncCard() {
  const toast = useToast();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [token, setToken] = useState('');
  useEffect(() => {
    const off = onSyncStatus(setStatus);
    return () => { off(); };
  }, []);
  const connected = status.state !== 'off';
  const color = status.state === 'error' ? 'var(--over)' : status.state === 'syncing' ? 'var(--carbs)' : 'var(--ok)';

  return (
    <section className="card">
      <div className="card-title">
        <span className="h2">Sincronización</span>
        {connected && (
          <span className="small muted row" style={{ gap: 6 }}>
            <i className="sync-dot" style={{ background: color }} />
            {status.state === 'syncing' ? 'Sincronizando…' : status.state === 'error' ? 'Error' : status.at ? `Hace ${ago(status.at)}` : 'Conectado'}
          </span>
        )}
      </div>
      {!connected ? (
        <div className="stack">
          <p className="small muted">
            Opcional. Guarda una copia privada en un Gist de tu cuenta de GitHub para tener el mismo historial en móvil y ordenador.
            Crea un token con permiso <b>gist</b> únicamente:{' '}
            <a href="https://github.com/settings/tokens/new?scopes=gist&description=Nutricion%20app" target="_blank" rel="noreferrer">crear token</a>.
          </p>
          <input className="input" type="password" autoComplete="off" placeholder="ghp_…" value={token} onChange={(e) => setToken(e.target.value.trim())} />
          <button className="btn primary sm" disabled={!token} onClick={async () => {
            lsSet(KEYS.ghToken, token);
            setToken('');
            await syncNow();
            if (getSyncStatus().state === 'idle') toast('Sincronizado');
          }}>Conectar</button>
        </div>
      ) : (
        <div className="stack">
          {status.state === 'error' && <div className="notice err">{status.message}</div>}
          <p className="small muted">Se sincroniza automáticamente al abrir la app y tras cada cambio.</p>
          <div className="row">
            <button className="btn ghost sm" onClick={() => { if (confirm('¿Desconectar? Los datos locales se mantienen.')) disconnectSync(); }}>Desconectar</button>
            <button className="btn sm grow" disabled={status.state === 'syncing'} onClick={() => void syncNow()}>
              <IconSync size={16} /> Sincronizar ahora
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DataCard() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section className="card">
      <div className="card-title"><span className="h2">Datos</span></div>
      <div className="row">
        <button className="btn sm grow" onClick={async () => {
          const snap = await exportAll();
          const blob = new Blob([JSON.stringify(snap, null, 1)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `nutricion-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }}>Exportar copia</button>
        <button className="btn sm ghost grow" onClick={() => fileRef.current?.click()}>Importar</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden-input" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            await mergeSnapshot(JSON.parse(await f.text()));
            toast('Importado');
          } catch {
            toast('Archivo no válido');
          }
        }} />
      </div>
    </section>
  );
}

function ago(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'un momento';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}
