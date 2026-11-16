import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { IconBack, IconClose, IconSearch } from './Icons';

// ---------- Sheet ----------
export function Sheet(props: {
  title?: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [props.onClose]);
  return (
    <>
      <div className="backdrop" onClick={props.onClose} />
      <div className={`sheet ${props.full ? 'full' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-head">
          {props.onBack && (
            <button className="icon-btn" onClick={props.onBack} aria-label="Atrás" style={{ marginLeft: -10 }}>
              <IconBack />
            </button>
          )}
          <div className="h2 ellipsis">{props.title}</div>
          <button className="icon-btn" onClick={props.onClose} aria-label="Cerrar"><IconClose /></button>
        </div>
        <div className="sheet-body grow">{props.children}</div>
        {props.footer && <div className="sheet-foot">{props.footer}</div>}
      </div>
    </>
  );
}

// ---------- Numeric field (accepts decimal comma) ----------
export const parseNum = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const show = (v: number | undefined) => (v === undefined || v === 0 ? '' : String(Math.round(v * 100) / 100).replace('.', ','));

export function NumInput(props: {
  value: number | undefined;
  onChange: (v: number) => void;
  suffix?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(show(props.value));
  // Re-sync when the value is changed from outside (e.g. scan result, chip).
  useEffect(() => {
    if (Math.abs(parseNum(text) - (props.value ?? 0)) > 1e-6) setText(show(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  return (
    <div className="input-wrap">
      <input
        className={`input ${props.className ?? ''}`}
        inputMode="decimal"
        placeholder={props.placeholder ?? '0'}
        value={text}
        autoFocus={props.autoFocus}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, '');
          setText(t);
          props.onChange(parseNum(t));
        }}
      />
      {props.suffix && <span className="suffix">{props.suffix}</span>}
    </div>
  );
}

export function SearchInput(props: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <div className="search">
      <IconSearch size={18} />
      <input
        className="input"
        type="search"
        value={props.value}
        placeholder={props.placeholder}
        autoFocus={props.autoFocus}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

export function Segmented<T extends string | number>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {props.options.map((o) => (
        <button key={String(o.value)} className={o.value === props.value ? 'active' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Ring ----------
export function Ring(props: { value: number; goal: number; size?: number; stroke?: number; children?: ReactNode }) {
  const size = props.size ?? 148;
  const stroke = props.stroke ?? 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = props.goal > 0 ? Math.min(1, props.value / props.goal) : 0;
  const over = props.value > props.goal && props.goal > 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={over ? 'var(--over)' : 'var(--kcal)'} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="center">{props.children}</div>
    </div>
  );
}

export function MacroBar(props: { label: string; value: number; goal: number; color: string; unit?: string }) {
  const pct = props.goal > 0 ? Math.min(100, (props.value / props.goal) * 100) : 0;
  return (
    <div className="macro">
      <div className="macro-head">
        <span className="muted">{props.label}</span>
        <span className="num">
          <b>{Math.round(props.value)}</b>
          <span className="muted"> / {Math.round(props.goal)} {props.unit ?? 'g'}</span>
        </span>
      </div>
      <div className="bar"><i style={{ width: `${pct}%`, background: props.color }} /></div>
    </div>
  );
}

// ---------- Toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={setMsg}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export function Thumb({ name, src }: { name: string; src?: string }) {
  if (src) return <img className="thumb" src={src} alt="" loading="lazy" />;
  return <div className="thumb">{name.trim().charAt(0).toUpperCase() || '·'}</div>;
}
