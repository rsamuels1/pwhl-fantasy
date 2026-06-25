"use client";

import { useState, useEffect } from "react";

interface Props {
  milestoneKey: string;
  message: string;
}

export default function MilestoneToast({ milestoneKey, message }: Props) {
  const [visible, setVisible] = useState(false);
  const [srMessage, setSrMessage] = useState("");

  useEffect(() => {
    if (!localStorage.getItem(milestoneKey)) {
      setVisible(true);
      // Delay so the live region is in the DOM before content is set
      requestAnimationFrame(() => setSrMessage(message));
      localStorage.setItem(milestoneKey, "1");
      const t = setTimeout(() => {
        setVisible(false);
        setSrMessage("");
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [milestoneKey, message]);

  return (
    <>
      {/* Always-present live region — screen readers announce when srMessage is set */}
      <div role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">
        {srMessage}
      </div>
      {visible && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: "rgba(95,169,140,0.95)", color: "#0f1117",
            padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 700,
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            zIndex: 9999, whiteSpace: "nowrap",
            animation: "fadeSlideUp 0.3s ease-out both",
          }}
        >
          {message}
        </div>
      )}
    </>
  );
}
