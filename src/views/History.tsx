import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Goals } from '../types';
import { alive, db, entriesBetween, saveWeight } from '../db';
import { fmt, totals } from '../lib/nutrients';
import { addDays, dayMonth, humanDate, rangeDays, shortDay, today } from '../lib/date';
import { NumInput, Segmented, useToast } from '../components/ui';
import { IconRight } from '../components/Icons';

const RANGES = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

export function History(props: { goals: Goals; openDay: (d: string) => void }) {
  const { goals } = props;
  const [range, setRange] = useState(7);
  const end = today();
  const start = addDays(end, -(range - 1));
  const entries = useLiveQuery(() => entriesBetween(start, end), [start, end]) ?? [];
  const weights = useLiveQuery(
    () => db.weights.where('date').between(addDays(end, -364), end, true, true).filter(alive).sortBy('date'),
    [end],
  ) ?? [];

  const days = useMemo(() => {
    const by = new Map<string, typeof entries>();
    for (const e of entries) by.set(e.date, [...(by.get(e.date) ?? []), e]);
    return rangeDays(end, range).map((d) => ({ date: d, n: totals(by.get(d) ?? []), count: by.get(d)?.length ?? 0 }));
  }, [entries, end, range]);

  const logged = days.filter((d) => d.count > 0);
  const avg = logged.length ? totals([]) : null;
  if (avg) for (const d of logged) for (const k of Object.keys(avg) as (keyof typeof avg)[]) avg[k] += d.n[k] / logged.length;
  const onTarget = logged.filter((d) => Math.abs(d.n.kcal - goals.kcal) <= goals.kcal * 0.1).length;
  const proteinHit = logged.filter((d) => d.n.protein >= goals.protein * 0.9).length;

  return (
    <div className="stack-lg">
      <header className="topbar">
        <div>
          <div className="eyebrow">Progreso</div>
          <h1 className="title">Historial</h1>
        </div>
      </header>

      <Segmented value={range} onChange={setRange} options={RANGES} />

      <section className="card">
        <div className="card-title">
          <span className="h2">Calorías</span>
          <span className="small muted">objetivo {fmt(goals.kcal, 'kcal')}</span>
        </div>
        <KcalChart days={days.map((d) => ({ date: d.date, v: d.n.kcal }))} goal={goals.kcal} />
        <div className="grid-3" style={{ marginTop: 16 }}>
          <div className="stat"><span className="v num">{avg ? fmt(avg.kcal, 'kcal') : '—'}</span><span className="l">Media kcal</span></div>
          <div className="stat"><span className="v num">{logged.length}<span className="muted small">/{range}</span></span><span className="l">Días registrados</span></div>
          <div className="stat"><span className="v num">{logged.length ? Math.round((onTarget / logged.length) * 100) : 0}%</span><span className="l">En objetivo ±10%</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-title"><span className="h2">Macros medios</span><span className="small muted">por día registrado</span></div>
        {avg ? <MacroSplit p={avg.protein} c={avg.carbs} f={avg.fat} goals={goals} /> : <div className="empty">Sin datos en este periodo.</div>}
        {avg && (
          <div className="small muted" style={{ marginTop: 12 }}>
            Proteína ≥ 90 % del objetivo en {proteinHit} de {logged.length} días · fibra media {fmt(avg.fiber)} g · sal media {fmt(avg.salt, 'salt')} g
          </div>
        )}
      </section>

      <WeightCard weights={weights.map((w) => ({ date: w.date, v: w.kg }))} range={range} />

      <section className="card">
        <div className="card-title"><span className="h2">Días</span></div>
        {logged.length === 0 && <div className="empty">Nada registrado todavía.</div>}
        {[...logged].reverse().map((d) => {
          const pct = goals.kcal ? d.n.kcal / goals.kcal : 0;
          return (
            <button key={d.date} className="item" onClick={() => props.openDay(d.date)}>
              <div className="grow">
                <div>{humanDate(d.date)}</div>
                <div className="meta num">P {fmt(d.n.protein)} · H {fmt(d.n.carbs)} · G {fmt(d.n.fat)} · {d.count} alimentos</div>
              </div>
              <span className={`kcal num ${pct > 1.1 ? 'over' : ''}`}>{fmt(d.n.kcal, 'kcal')}</span>
              <IconRight size={16} style={{ color: 'var(--faint)' }} />
            </button>
          );
        })}
      </section>
    </div>
  );
}

function KcalChart({ days, goal }: { days: { date: string; v: number }[]; goal: number }) {
  const W = 340, H = 150, padB = 18, padT = 8;
  const max = Math.max(goal * 1.25, ...days.map((d) => d.v), 1);
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max);
  const n = days.length;
  const slot = W / n;
  const bw = Math.max(2, Math.min(26, slot * 0.62));
  const every = n <= 7 ? 1 : n <= 30 ? 5 : 15;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Calorías por día">
      {days.map((d, i) => {
        const x = i * slot + (slot - bw) / 2;
        const over = d.v > goal * 1.1;
        return (
          <g key={d.date}>
            {d.v > 0 ? (
              <rect x={x} y={y(d.v)} width={bw} height={Math.max(1, H - padB - y(d.v))} rx={Math.min(4, bw / 2)}
                fill={over ? 'var(--over)' : 'var(--kcal)'} opacity={d.date === today() ? 1 : 0.85}>
                <title>{`${dayMonth(d.date)}: ${Math.round(d.v)} kcal`}</title>
              </rect>
            ) : (
              <rect x={x} y={H - padB - 2} width={bw} height={2} rx={1} fill="var(--line)" />
            )}
            {(n - 1 - i) % every === 0 && (
              <text x={i * slot + slot / 2} y={H - 4} textAnchor="middle">{n <= 7 ? shortDay(d.date) : dayMonth(d.date)}</text>
            )}
          </g>
        );
      })}
      <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--text)" strokeOpacity={0.35} strokeDasharray="3 4" />
    </svg>
  );
}

function MacroSplit({ p, c, f, goals }: { p: number; c: number; f: number; goals: Goals }) {
  const kp = p * 4, kc = c * 4, kf = f * 9;
  const tot = kp + kc + kf || 1;
  const gp = goals.protein * 4, gc = goals.carbs * 4, gf = goals.fat * 9;
  const gt = gp + gc + gf || 1;
  const rows = [
    { l: 'Proteínas', g: p, goal: goals.protein, pct: kp / tot, gpct: gp / gt, color: 'var(--protein)' },
    { l: 'Hidratos', g: c, goal: goals.carbs, pct: kc / tot, gpct: gc / gt, color: 'var(--carbs)' },
    { l: 'Grasas', g: f, goal: goals.fat, pct: kf / tot, gpct: gf / gt, color: 'var(--fat)' },
  ];
  return (
    <div className="stack">
      <div className="bar" style={{ height: 10, display: 'flex', gap: 2, background: 'transparent' }}>
        {rows.map((r) => <i key={r.l} style={{ width: `${r.pct * 100}%`, background: r.color }} />)}
      </div>
      {rows.map((r) => (
        <div key={r.l} className="row between small">
          <span><i className="dot" style={{ background: r.color }} />{r.l}</span>
          <span className="num">
            <b>{Math.round(r.g)} g</b>
            <span className="muted"> / {r.goal} g · {Math.round(r.pct * 100)}% kcal (obj. {Math.round(r.gpct * 100)}%)</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const kgFmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString('es-ES', { minimumFractionDigits: 1 });

function WeightCard({ weights, range }: { weights: { date: string; v: number }[]; range: number }) {
  const toast = useToast();
  const t = today();
  const todays = weights.find((w) => w.date === t)?.v;
  const [kg, setKg] = useState<number | undefined>(undefined);
  const from = addDays(t, -(Math.max(range, 30) - 1));
  const pts = weights.filter((w) => w.date >= from);
  const last = weights[weights.length - 1];
  const first = pts[0];

  const W = 340, H = 110, pad = 10;
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs) - 0.5, hi = Math.max(...vs) + 0.5;
  const span = rangeDays(t, Math.max(range, 30));
  const x = (d: string) => pad + ((W - 2 * pad) * span.indexOf(d)) / Math.max(1, span.length - 1);
  const y = (v: number) => pad + (H - 2 * pad) * (1 - (v - lo) / (hi - lo || 1));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  return (
    <section className="card">
      <div className="card-title">
        <span className="h2">Peso</span>
        {last && (
          <span className="small muted num">
            {kgFmt(last.v)} kg
            {first && first !== last && ` · ${last.v - first.v >= 0 ? '+' : ''}${(Math.round((last.v - first.v) * 10) / 10).toLocaleString('es-ES')} kg`}
          </span>
        )}
      </div>
      {pts.length >= 2 ? (
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ marginBottom: 12 }}>
          <path d={path} fill="none" stroke="var(--text)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.v)} r={2.5} fill="var(--bg)" stroke="var(--text)" strokeWidth={1.4}><title>{`${dayMonth(p.date)}: ${kgFmt(p.v)} kg`}</title></circle>)}
          <text x={W - pad} y={y(hi - 0.5) - 2} textAnchor="end">{(hi - 0.5).toFixed(1)}</text>
          <text x={W - pad} y={y(lo + 0.5) + 10} textAnchor="end">{(lo + 0.5).toFixed(1)}</text>
        </svg>
      ) : (
        <p className="muted small" style={{ marginBottom: 12 }}>Registra tu peso varios días para ver la tendencia.</p>
      )}
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        if (!kg) return;
        await saveWeight(t, kg);
        setKg(undefined);
        toast('Peso guardado');
      }}>
        <div className="grow"><NumInput value={kg} onChange={setKg} suffix="kg" placeholder={todays ? `Hoy: ${kgFmt(todays)}` : 'Peso de hoy'} /></div>
        <button className="btn" type="submit" disabled={!kg}>Guardar</button>
      </form>
    </section>
  );
}
