"use client";

export default function DevTimeClear() {
  return (
    <button
      onClick={() => {
        document.cookie = "pwhl_dev_sim_date=; path=/; max-age=0";
        window.location.reload();
      }}
      style={{
        background: "none", border: "none", color: "#fbbf24",
        cursor: "pointer", fontSize: 11, textDecoration: "underline", padding: 0,
      }}
    >
      Clear
    </button>
  );
}
