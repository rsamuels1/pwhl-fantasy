"use client";

import { useState, useEffect } from "react";

interface Props {
  milestoneKey: string;   // localStorage key — toast fires once per key
  message: string;
}

export default function MilestoneToast({ milestoneKey, message }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(milestoneKey)) {
      setVisible(true);
      localStorage.setItem(milestoneKey, "1");
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [milestoneKey]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: "rgba(95,169,140,0.95)", color: "#fff",
      padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 700,
      boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      zIndex: 9999, whiteSpace: "nowrap",
      animation: "fadeSlideUp 0.3s ease-out both",
    }}>
      {message}
    </div>
  );
}
