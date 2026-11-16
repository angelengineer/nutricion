import { useEffect, useRef, useState } from 'react';
import type { Goals, Profile } from '../types';
import { exportBackup, importBackup, saveSettings, useStore } from '../store';
import { DEFAULT_GOALS, suggestGoals } from '../lib/nutrients';
import { NumInput, Segmented, useToast } from '../components/ui';

export function Settings() {
  const store = useStore();
  return (
    <div className="stack-lg">
      <header className="topbar">
        <div>
          <div className="eyebrow">Configuración</div>
          <h1 className="title">Ajustes</h1>
        </div>
      </header>
      <GoalsCard goals={store.goals} profile={store.profile} />
      <StorageCard mode={store.mode} foods={store.foods.length} days={Object.keys(store.days).length} />
      <DataCard />
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

function GoalsCard({ goals, profile }: { goals: Goals; profile: Profile | null }) {
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
      {calc && <Calculator saved={profile} onApply={(s) => { setG(s); setCalc(false); }} />}
      <div className="nutri-table">
        {GOAL_FIELDS.map((f) => (
          <div key={f.k} className="nutri-row">
            <label>{f.l}</label>
            <NumInput value={g[f.k]} onChange={(v) => setG({ ...g, [f.k]: v })} suffix={f.u} />
          </div>
        ))}
      </div>
      <p className={`small ${Math.abs(macroKcal - g.kcal) > g.kcal * 0.05 ? 'over' : 'muted'}`} style={{ margin: '10px 0' }}>
        Proteínas + hidratos + grasas = {Math.round(macroKcal)} kcal ({g.kcal ? Math.round((macroKcal / g.kcal) * 100) : 0}% del objetivo)
      </p>
      <div className="row">
        <button className="btn ghost sm" onClick={() => setG(DEFAULT_GOALS)}>Restablecer</button>
        <button className="btn primary sm grow" disabled={!dirty} onClick={() => { saveSettings({ goals: g }); toast('Objetivos guardados'); }}>
          Guardar objetivos
        </button>
      </div>
    </section>
  );
}

function Calculator({ saved, onApply }: { saved: Profile | null; onApply: (g: Goals) => void }) {
  const [p, setP] = useState<Profile>(saved ?? { sex: 'male', age: 25, heightCm: 175, weightKg: 70, activity: 1.55, objective: 'maintain' });
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
        options={[{ value: 'lose', label: 'Perder grasa' }, { value: 'maintain', label: 'Mantener' }, { value: 'gain', label: 'Ganar' }]} />
      <div className="notice num">
        {s.kcal} kcal · P {s.protein} g · H {s.carbs} g · G {s.fat} g
        <div className="small" style={{ marginTop: 4 }}>Mifflin–St Jeor × actividad{p.objective === 'lose' ? ' − 20 %' : p.objective === 'gain' ? ' + 10 %' : ''}. Proteína por kg de peso, grasa 27 % de la energía.</div>
      </div>
      <button className="btn sm" onClick={() => { saveSettings({ profile: p }); onApply(s); }}>Usar estos valores</button>
    </div>
  );
}

function StorageCard({ mode, foods, days }: { mode: string; foods: number; days: number }) {
  const cloud = mode === 'cloud';
  return (
    <section className="card">
      <div className="card-title">
        <span className="h2">Tus datos</span>
        <span className="small muted row" style={{ gap: 6 }}>
          <i className="sync-dot" style={{ background: cloud ? 'var(--ok)' : 'var(--carbs)' }} />
          {cloud ? 'En la nube' : 'Solo este navegador'}
        </span>
      </div>
      <p className="small muted">
        {cloud
          ? 'Se guardan en la base de datos de este artifact en claude.ai: los ves desde cualquier dispositivo con tu cuenta, y puedes pedirle a Claude que los analice o los corrija.'
          : 'Esta copia de la app no está dentro de claude.ai, así que los cambios se quedan en este navegador.'}
      </p>
      <p className="small muted num" style={{ marginTop: 8 }}>{foods} alimentos guardados · {days} días cargados</p>
    </section>
  );
}

function DataCard() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [canExport, setCanExport] = useState(false);
  useEffect(() => {
    void window.claude?.use('downloads').then((d) => setCanExport(!!d)).catch(() => {});
  }, []);

  async function exportJson() {
    const dl = await window.claude?.use('downloads').catch(() => null);
    if (!dl) return;
    try {
      const res = await dl.save({
        filename: `nutricion-${new Date().toISOString().slice(0, 10)}.json`,
        data: JSON.stringify(exportBackup(), null, 1),
      });
      if (res?.status === 'saved') toast('Copia guardada');
    } catch {
      /* the viewer declined */
    }
  }

  return (
    <section className="card">
      <div className="card-title"><span className="h2">Copia de seguridad</span></div>
      <div className="row">
        {canExport && <button className="btn sm grow" onClick={() => void exportJson()}>Exportar JSON</button>}
        <button className="btn sm ghost grow" onClick={() => fileRef.current?.click()}>Importar JSON</button>
        <input ref={fileRef} id="import-file" type="file" accept="application/json,.json" className="hidden-input" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            importBackup(JSON.parse(await f.text()));
            toast('Importado');
          } catch {
            toast('El archivo no es una copia válida');
          }
        }} />
      </div>
    </section>
  );
}
