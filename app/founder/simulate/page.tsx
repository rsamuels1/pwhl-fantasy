import { SimulateCenter } from "./SimulateCenter";

export default function SimulatePage() {
  return (
    <div style={{ maxWidth: "700px" }}>
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", color: "#ccc" }}>
        Simulation Center
      </h1>
      <p style={{ fontSize: "0.82rem", color: "#555", marginBottom: "1.5rem" }}>
        End-to-end season validation. Creates a throwaway league, runs the full product flow, and reports the champion.
      </p>
      <SimulateCenter />
    </div>
  );
}
