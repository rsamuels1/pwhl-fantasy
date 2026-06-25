export default function StandingsLoading() {
  return (
    <>
      <style>{`
        @keyframes stPulse { 0%,100%{opacity:.35} 50%{opacity:.7} }
        .st-bone { background:var(--panel,rgba(255,255,255,.06)); border-radius:6px; animation:stPulse 1.6s ease-in-out infinite; }
      `}</style>
      {/* Column headers */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10, paddingBottom:8, borderBottom:"1px solid var(--border)" }}>
        <div className="st-bone" style={{ width:24, height:12 }} />
        <div className="st-bone" style={{ flex:1, height:12 }} />
        {[28,28,28,36,40].map((w,i) => (
          <div key={i} className="st-bone" style={{ width:w, height:12 }} />
        ))}
      </div>
      {/* Team rows */}
      {Array.from({ length:8 }).map((_,i) => (
        <div key={i} style={{ display:"flex", gap:8, alignItems:"center", padding:"10px 0", borderBottom:"1px solid rgba(148,163,184,.07)" }}>
          <div className="st-bone" style={{ width:20, height:13 }} />
          <div className="st-bone" style={{ flex:1, height:13 }} />
          {[28,28,28,36,44].map((w,j) => (
            <div key={j} className="st-bone" style={{ width:w, height:13 }} />
          ))}
        </div>
      ))}
    </>
  );
}
