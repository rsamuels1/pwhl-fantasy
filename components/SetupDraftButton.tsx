"use client";

import { useState } from "react";

export default function SetupDraftButton({ leagueId }: { leagueId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSetupDraft = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/setup`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Draft created! Refresh to see updates.");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(data.error || "Failed to setup draft");
      }
    } catch (error) {
      setMessage("Error setting up draft");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSetupDraft}
        disabled={loading}
        className="button-primary"
        style={{ marginTop: 12 }}
      >
        {loading ? "Setting up…" : "Setup Draft"}
      </button>
      {message && (
        <p style={{ color: message.includes("Error") ? "#ef4444" : "#22c55e", marginTop: 12 }}>
          {message}
        </p>
      )}
    </div>
  );
}
