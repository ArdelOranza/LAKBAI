export default function Logo({ size = 40, withWordmark = false }){
  const id = withWordmark ? 'lgw' : 'lg';
  const mark = (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2280E8"/><stop offset="1" stopColor="#0A3D8F"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="34" fill={`url(#${id})`}/>
      <path fill="#fff" d="M36 104 C35 86 45 27 49 21 Q51 18 60 18 Q69 18 71 21 C75 27 85 86 84 104 L68 104 C68 96 70 62 66 54 Q65 51 60 51 Q55 51 54 54 C50 62 52 96 52 104 Z"/>
      <rect x="53" y="30" width="14" height="26" rx="7" fill="#1667D9"/>
    </svg>
  );
  if (!withWordmark) return mark;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      {mark}
      <div>
        <div style={{ fontWeight:800, fontSize:size*0.72, color:'var(--ink)', lineHeight:1 }}>LakbAI</div>
        <div style={{ fontSize:11, color:'var(--muted-ink)', marginTop:2 }}>Lakbai, smarter, not harder.</div>
      </div>
    </div>
  );
}
