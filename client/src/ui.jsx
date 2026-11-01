import { House, Map, MessageSquare, Backpack, UserRound, Check, AlertCircle, X, Image as ImageIcon } from 'lucide-react';

/** Neutral, icon-based stand-in for a missing photo. No gradients, no emoji. */
export function PhotoPlaceholder({ label, size = 26, rounded = 0, style }){
  return (
    <div aria-hidden="true" style={{ width:'100%', height:'100%', background:'#EDF1F7', display:'grid', placeItems:'center', textAlign:'center', borderRadius:rounded, ...style }}>
      <div style={{ color:'#9AA8BA' }}>
        <ImageIcon size={size} strokeWidth={1.6}/>
        {label && <div style={{ fontSize:11, marginTop:5 }}>{label}</div>}
      </div>
    </div>
  );
}

export function Toast({ toast, onClose }){
  if (!toast) return null;
  return (
    <div role="status" data-testid="toast" className={'toast ' + (toast.kind || '')}>
      <span className="tick">{toast.kind === 'error' ? <AlertCircle size={16}/> : <Check size={16}/>}</span>
      <span style={{ flex:1 }}>
        <b>{toast.text}</b>
        {toast.detail && <div style={{ color:'var(--muted-ink)' }}>{toast.detail}</div>}
      </span>
      <button onClick={onClose} aria-label="Dismiss"><X size={16}/></button>
    </div>
  );
}

const TAB_ITEMS = [
  ['home', House], ['map', Map], ['chat', MessageSquare], ['saved', Backpack], ['profile', UserRound],
];
export function TabBar({ tab, onTab }){
  return (
    <nav className="tabbar" aria-label="Main">
      {TAB_ITEMS.map(([id, Icon]) => (
        <button key={id} data-testid={'nav-' + id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} aria-label={id[0].toUpperCase() + id.slice(1)} onClick={() => onTab(id)}>
          <span className="navdot"><Icon size={21} strokeWidth={2}/></span>
        </button>
      ))}
    </nav>
  );
}

export function Chip({ active, onClick, children, testid, flat }){
  return <button type="button" data-testid={testid} className={'chip' + (flat ? ' chip-flat' : '') + (active ? ' active' : '')} onClick={onClick}>{children}</button>;
}
export function PrimaryBtn({ children, onClick, wide, disabled, testid }){
  return <button data-testid={testid} className={'primary-btn' + (wide ? ' wide' : '')} onClick={onClick} disabled={disabled}>{children}</button>;
}
