export function Toast({ toast, onClose }){
  if (!toast) return null;
  return (
    <div role="status" data-testid="toast" className={'toast ' + (toast.kind || '')}>
      <span className="tick">{toast.kind === 'error' ? '!' : '✓'}</span>
      <span style={{ flex:1 }}>
        <b>{toast.text}</b>
        {toast.detail && <div style={{ color:'var(--muted-ink)' }}>{toast.detail}</div>}
      </span>
      <button onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}

const TAB_ITEMS = [
  ['home','Home'],['map','Map'],['chat','Chat'],['saved','Saved'],['profile','Profile']
];
export function TabBar({ tab, onTab }){
  return (
    <nav className="tabbar" aria-label="Main">
      {TAB_ITEMS.map(([id,label]) => (
        <button key={id} data-testid={'nav-' + id} className={tab === id ? 'active' : ''} aria-current={tab === id} onClick={() => onTab(id)}>
          <span className={tab === id ? 'tabdot' : ''}><TabIcon id={id}/></span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
function TabIcon({ id }){
  const p = { width:20, height:20, fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' };
  if (id === 'home') return <svg {...p} viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>;
  if (id === 'map') return <svg {...p} viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>;
  if (id === 'chat') return <svg {...p} viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>;
  if (id === 'saved') return <svg {...p} viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2"/></svg>;
  return <svg {...p} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"/></svg>;
}

export function Chip({ active, onClick, children, testid }){
  return <button type="button" data-testid={testid} className={'chip' + (active ? ' active' : '')} onClick={onClick}>{children}</button>;
}
export function PrimaryBtn({ children, onClick, wide, disabled, testid }){
  return <button data-testid={testid} className={'primary-btn' + (wide ? ' wide' : '')} onClick={onClick} disabled={disabled}>{children}</button>;
}
