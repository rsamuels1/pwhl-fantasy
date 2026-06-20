import { DEFAULT_SCORING, type ScoringSettings } from "./index";

const SKATER_FIELDS = ["goal","assist","shot","plusMinus","penaltyMinute","powerPlayPoint","hit","block"] as const;
const GOALIE_FIELDS = ["win","save","goalAgainst","shutout"] as const;

export function parseScoringSettings(raw: unknown): ScoringSettings {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const sk = r["skater"];
    const go = r["goalie"];
    if (
      sk && typeof sk === "object" &&
      go && typeof go === "object" &&
      SKATER_FIELDS.every((f) => typeof (sk as Record<string, unknown>)[f] === "number") &&
      GOALIE_FIELDS.every((f) => typeof (go as Record<string, unknown>)[f] === "number")
    ) {
      return raw as ScoringSettings;
    }
  }
  return DEFAULT_SCORING;
}
