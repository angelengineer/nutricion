import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Meal } from './types';
import { getGoals } from './db';
import { DEFAULT_GOALS } from './lib/nutrients';
import { today } from './lib/date';
import { ToastProvider } from './components/ui';
import { IconBook, IconChart, IconPlus, IconSettings, IconToday } from './components/Icons';
import { Today } from './views/Today';
import { History } from './views/History';
import { Foods } from './views/Foods';
import { Settings } from './views/Settings';
import { AddFlow } from './views/AddFlow';

type Tab = 'hoy' | 'historial' | 'alimentos' | 'ajustes';
const TABS: Tab[] = ['hoy', 'historial', 'alimentos', 'ajustes'];

const readTab = (): Tab => {
  const h = location.hash.replace('#/', '') as Tab;
  return TABS.includes(h) ? h : 'hoy';
};

function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 19 && h < 24) return 'dinner';
  return 'snack';
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(readTab);
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<Meal | null>(null);
  const goals = useLiveQuery(() => getGoals(), []) ?? DEFAULT_GOALS;

  useEffect(() => {
    const onHash = () => setTabState(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Roll "today" over if the app stays open past midnight.
  useEffect(() => {
    let last = today();
    const id = setInterval(() => {
      const t = today();
      if (t !== last) {
        setDate((d) => (d === last ? t : d));
        last = t;
      }
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const setTab = (t: Tab) => {
    location.hash = `/${t}`;
    window.scrollTo({ top: 0 });
  };

  return (
    <ToastProvider>
      <main className="app">
        {tab === 'hoy' && <Today date={date} setDate={setDate} goals={goals} onAdd={setAdding} />}
        {tab === 'historial' && <History goals={goals} openDay={(d) => { setDate(d); setTab('hoy'); }} />}
        {tab === 'alimentos' && <Foods />}
        {tab === 'ajustes' && <Settings goals={goals} />}
      </main>

      <nav className="nav">
        <div className="nav-inner">
          <NavBtn label="Hoy" active={tab === 'hoy'} onClick={() => setTab('hoy')}><IconToday /></NavBtn>
          <NavBtn label="Historial" active={tab === 'historial'} onClick={() => setTab('historial')}><IconChart /></NavBtn>
          <button className="fab" aria-label="Añadir alimento" onClick={() => setAdding(defaultMeal())}><IconPlus size={24} /></button>
          <NavBtn label="Alimentos" active={tab === 'alimentos'} onClick={() => setTab('alimentos')}><IconBook /></NavBtn>
          <NavBtn label="Ajustes" active={tab === 'ajustes'} onClick={() => setTab('ajustes')}><IconSettings /></NavBtn>
        </div>
      </nav>

      {adding && (
        <AddFlow
          date={tab === 'hoy' ? date : today()}
          meal={adding}
          onClose={() => setAdding(null)}
        />
      )}
    </ToastProvider>
  );
}

function NavBtn(props: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`nav-btn ${props.active ? 'active' : ''}`} onClick={props.onClick}>
      {props.children}
      {props.label}
    </button>
  );
}
