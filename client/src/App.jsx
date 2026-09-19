import { useEffect, useState } from 'react';
import MapView from './MapView.jsx';
import { recommend } from './api.js';
import { ItineraryPanel, NearbyButton, Reviews, EmergencyPanel } from './Panels.jsx';

const BASE = import.meta.env.VITE_API_URL || '';

export default function App(){
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [places, setPlaces] = useState([]);
  const [spotlight, setSpotlight] = useState(null);
  const [status, setStatus] = useState('');
  const [focus, setFocus] = useState(null);
  const [selected, setSelected] = useState([]);
  const [notice, setNotice] = useState('');
  const [readyError, setReadyError] = useState('');

  useEffect(() => {
    fetch(`${BASE}/api/ready`)
      .then(r => { if (!r.ok) throw new Error('API keys missing'); return r.json(); })
      .catch(() => setReadyError('Server not ready — check GEMINI_API_KEY and VITE_MAPBOX_TOKEN in .env.'));
  }, []);

  function applyResults(out){
    setMessages(m => [...m, { role: 'assistant', text: out.answer }]);
    setPlaces(out.places || []);
    setSpotlight(out.spotlight || null);
    setStatus('');
    setFocus(null);
  }

  async function send(){
    const text = input.trim();
    if (!text) return;
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    setStatus('Searching Pangasinan…');
    try {
      applyResults(await recommend(text));
    } catch (e) {
      setStatus('');
      setNotice(e.message);
    }
  }

  function toggleSelect(p){
    setSelected(s => s.some(x => x.id === p.id) ? s.filter(x => x.id !== p.id) : [...s, p]);
  }

  return (
    <div data-testid="app">
      <h1>Lakbai</h1>
      <p data-testid="scope-note">Pangasinan only · MVP</p>
      {readyError && <p data-testid="notice">{readyError}</p>}
      <section data-testid="chat">
        <ul>{messages.map((m, i) => <li key={i}><b>{m.role}:</b> {m.text}</li>)}</ul>
        <input data-testid="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Ask about Pangasinan…" />
        <button data-testid="chat-send" onClick={send}>Send</button>
      </section>
      {status && <p data-testid="search-status" className="shimmer">{status}</p>}
      {notice && <p data-testid="notice">{notice}</p>}
      <MapView places={places} focus={focus} />
      {spotlight && (
        <article data-testid="spotlight">
          <h3>Hidden gem: {spotlight.name}</h3>
          <p>{spotlight.reason}</p>
        </article>
      )}
      <ul>
        {places.map((p, i) => (
          <li key={p.id} data-testid="place-card" className="place-card" style={{ animationDelay: `${i * 120}ms` }} onClick={() => setFocus(p)}>
            <b>{p.name}</b> <span>{(p.categories || []).join(', ')}</span>
            <p>{p.reason}</p>
            {(p.sources || []).map(s => <a key={s} href={s} target="_blank" rel="noreferrer">{p.sourceKind === 'map' ? 'map' : 'source'}</a>)}
            <button onClick={e => { e.stopPropagation(); toggleSelect(p); }}>
              {selected.some(x => x.id === p.id) ? 'Remove' : 'Add to itinerary'}
            </button>
          </li>
        ))}
      </ul>
      <ItineraryPanel selected={selected} />
      <NearbyButton onResults={applyResults} onNotice={setNotice} />
      {places.map(p => <Reviews key={'r-' + p.id} place={p} />)}
      <EmergencyPanel />
    </div>
  );
}
