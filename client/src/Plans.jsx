import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { supabase } from './supabaseClient.js';
const BASE = import.meta.env.VITE_API_URL || '';
export default function Plans(){
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [hours, setHours] = useState(8);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  async function build(){
    setError('');
    const r = await fetch(`${BASE}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: input, hours: Number(hours) || 8 }) });
    if (!r.ok) { setError('Could not build plan'); return; }
    setPlan(await r.json());
  }
  async function save(){
    if (!plan) return;
    if (supabase && user) {
      await supabase.from('plans').insert({ user_id: user.id, title: plan.title, schedule: plan.schedule });
    } else {
      const all = JSON.parse(localStorage.getItem('lakbai-plans') || '[]');
      all.push({ ...plan, at: Date.now() });
      localStorage.setItem('lakbai-plans', JSON.stringify(all));
    }
  }
  return (
    <section>
      <h2>AI trip planner</h2>
      <input data-testid="plan-input" value={input} onChange={e => setInput(e.target.value)} placeholder="2-day Alaminos food trip" />
      <input data-testid="plan-hours" value={hours} onChange={e => setHours(e.target.value)} inputMode="numeric" aria-label="Hours" />
      <button data-testid="plan-build" onClick={build}>Build</button>
      {error && <p data-testid="notice">{error}</p>}
      {plan && <><h3>{plan.title}</h3><button data-testid="plan-save" onClick={save}>Save plan</button>
      <ol>{plan.schedule.map(s => <li key={s.placeId} data-testid="plan-item">{s.arrive}–{s.depart} {s.name}<ul>{(s.activities || []).map(a => <li key={a}>{a}</li>)}</ul></li>)}</ol></>}
    </section>
  );
}
