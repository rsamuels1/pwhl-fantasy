export default function LeagueOverviewLoading() {
  return (
    <>
      <style>{`
        @keyframes lgPulse { 0%,100%{opacity:.35} 50%{opacity:.7} }
        .lg-bone { background:var(--panel,rgba(255,255,255,.06)); border-radius:6px; animation:lgPulse 1.6s ease-in-out infinite; }
      `}</style>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:24, alignItems:"start" }}>
        {/* Left — race table */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div className="lg-bone" style={{ height:20, width:160 }} />
          {Array.from({ length:8 }).map((_,i) => (
            <div key={i} style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div className="lg-bone" style={{ width:20, height:14, flexShrink:0 }} />
              <div className="lg-bone" style={{ flex:1, height:14 }} />
              <div className="lg-bone" style={{ width:32, height:14 }} />
              <div className="lg-bone" style={{ width:32, height:14 }} />
              <div className="lg-bone" style={{ width:48, height:20, borderRadius:20 }} />
            </div>
          ))}
        </div>
        {/* Right — sidebar */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="lg-bone" style={{ height:80, borderRadius:10 }} />
          <div className="lg-bone" style={{ height:120, borderRadius:10 }} />
        </div>
      </div>
    </>
  );
}
