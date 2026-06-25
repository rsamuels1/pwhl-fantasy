"use client";

function Bone({ w, h, radius = 6 }: { w?: string | number; h: number; radius?: number }) {
  return (
    <div
      className="draft-bone"
      style={{ width: w ?? "100%", height: h, borderRadius: radius, flexShrink: 0 }}
    />
  );
}

function DesktopSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Left col: pick board */}
      <div style={{
        width: 300, flexShrink: 0, padding: "20px 16px 24px",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 14,
        overflowY: "auto",
      }}>
        <Bone w={100} h={16} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          {Array.from({ length: 52 }).map((_, i) => <Bone key={i} h={28} />)}
        </div>
        <Bone w={90} h={13} />
        {Array.from({ length: 5 }).map((_, i) => <Bone key={i} h={26} />)}
      </div>

      {/* Center col: player panel */}
      <div style={{
        flex: 1, padding: "20px 20px 24px",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 14,
        overflowY: "auto", minWidth: 0,
      }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Bone h={36} />
          {["F", "D", "G", "All"].map((p) => <Bone key={p} w={44} h={36} />)}
        </div>
        <Bone w={180} h={13} />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Bone w={32} h={32} radius={50} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Bone w="58%" h={13} />
              <Bone w="38%" h={11} />
            </div>
            {[40, 32, 32, 32, 32, 32, 32].map((w, j) => <Bone key={j} w={w} h={13} />)}
            <Bone w={44} h={36} />
          </div>
        ))}
      </div>

      {/* Right col: needs + my picks */}
      <div style={{
        width: 260, flexShrink: 0, padding: "20px 16px 24px",
        display: "flex", flexDirection: "column", gap: 14,
        overflowY: "auto",
      }}>
        <Bone w={80} h={15} />
        {["F", "F", "F", "D", "D", "G", "UTIL"].map((_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Bone w={44} h={13} />
            <Bone w={90} h={13} />
          </div>
        ))}
        <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
        <Bone w={80} h={15} />
        {Array.from({ length: 3 }).map((_, i) => <Bone key={i} h={22} />)}
      </div>
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {["Pick", "Board", "Needs"].map((tab) => (
          <div key={tab} style={{
            flex: 1, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bone w={48} h={13} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Bone h={36} />
          {["F", "D", "G"].map((p) => <Bone key={p} w={40} h={36} />)}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Bone w={32} h={32} radius={50} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Bone w="62%" h={14} />
              <Bone w="38%" h={11} />
            </div>
            <Bone w={44} h={36} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DraftSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <style>{`
        @keyframes draftBonePulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
        .draft-bone {
          background: var(--surface-2, rgba(255,255,255,0.07));
          animation: draftBonePulse 1.6s ease-in-out infinite;
        }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* TopBar */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: 52,
          background: "rgba(10,14,26,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
          gap: 12,
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Bone w={58} h={32} />
            <Bone w={140} h={18} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Bone w={64} h={30} />
            <Bone w={80} h={30} />
          </div>
        </header>

        {isMobile ? <MobileSkeleton /> : <DesktopSkeleton />}
      </div>
    </>
  );
}
