// lib/copy/living-league-glossary.ts
// Single source of truth for fan-first copy across awards, stat chips, and explainer text.
// Uses __TEAM_ID__ as a placeholder that callers replace with the actual team ID at render time.

export type AwardCopyKey =
  | "ice_cold_closer"
  | "heater"
  | "heartbreaker"
  | "collapse"
  | "frozen_stick";

export type ChipCopyKey =
  | "streak"
  | "projection_swing_up"
  | "projection_swing_down"
  | "weekly_leader"
  | "league_record";

export type LivingLeagueCopyKey = AwardCopyKey | ChipCopyKey;

export interface LivingLeagueCopyEntry {
  icon: string;
  label: string;
  // One sentence, written for a first-time fantasy player. "FP" always expanded on first use.
  explainer: string;
  // For negative awards only: where to go to recover.
  recoveryLink?: string;
  recoveryLabel?: string;
  // Whether this is a negative-valence award (controlled by showNegativeAwards toggle).
  isNegative?: boolean;
}

export const LIVING_LEAGUE_COPY: Record<LivingLeagueCopyKey, LivingLeagueCopyEntry> = {
  // ── Awards ──────────────────────────────────────────────────────────────────

  ice_cold_closer: {
    icon: "🏆",
    label: "Ice-Cold Closer",
    explainer:
      "Your team scored the most fantasy points (FP) in the league this week — every goal, assist, and save added up to the best total in the building.",
  },

  heater: {
    icon: "🔥",
    label: "Heater Award",
    explainer:
      "Your team scored way more fantasy points (FP) than anyone predicted — your players showed up and then some.",
  },

  heartbreaker: {
    icon: "💀",
    label: "Heartbreaker",
    explainer:
      "Your team put up a huge score this week but still lost the matchup — tough break. Those fantasy points (FP) counted, just not enough this time.",
    isNegative: true,
    recoveryLink: "/team/__TEAM_ID__/roster",
    recoveryLabel: "Check your roster →",
  },

  collapse: {
    icon: "📉",
    label: "Collapse of the Week",
    explainer:
      "Your team scored a lot fewer fantasy points (FP) than expected this week. Next week resets — check the waiver wire for players who can help.",
    isNegative: true,
    recoveryLink: "/team/__TEAM_ID__/roster",
    recoveryLabel: "Find players →",
  },

  frozen_stick: {
    icon: "🧊",
    label: "Frozen Stick",
    explainer:
      "Quiet week for your squad — they ended up with the lowest score in the league. Next week resets — try adjusting your lineup before games tip off.",
    isNegative: true,
    recoveryLink: "/team/__TEAM_ID__/roster",
    recoveryLabel: "Set your lineup →",
  },

  // ── Stat Chips ──────────────────────────────────────────────────────────────

  streak: {
    icon: "🔥",
    label: "On a streak",
    explainer:
      "This player has scored fantasy points (FP) in three or more games in a row — they're on a hot streak right now.",
  },

  projection_swing_up: {
    icon: "⚡",
    label: "Outperformed projection",
    explainer:
      "This player scored significantly more fantasy points (FP) than our projection predicted — a great surprise for your lineup.",
  },

  projection_swing_down: {
    icon: "⬇",
    label: "Below projection",
    explainer:
      "This player scored noticeably fewer fantasy points (FP) than expected — everyone has off weeks.",
  },

  weekly_leader: {
    icon: "⭐",
    label: "League leader this week",
    explainer:
      "This player has the highest fantasy point (FP) total of any active player across every team in your league this week.",
  },

  league_record: {
    icon: "🏅",
    label: "League record",
    explainer:
      "This player just had one of the highest-scoring weeks we've ever seen in this league — a performance worth remembering.",
  },
};

export function getAwardCopy(type: string): LivingLeagueCopyEntry {
  return (
    LIVING_LEAGUE_COPY[type as AwardCopyKey] ?? {
      icon: "🏆",
      label: type,
      explainer: "A standout performance this week.",
    }
  );
}

export function getChipCopy(type: string): LivingLeagueCopyEntry {
  return (
    LIVING_LEAGUE_COPY[type as ChipCopyKey] ?? {
      icon: "⭐",
      label: type,
      explainer: "A notable stat this week.",
    }
  );
}

export function resolveRecoveryLink(entry: LivingLeagueCopyEntry, teamId: string): string | undefined {
  return entry.recoveryLink?.replace("__TEAM_ID__", teamId);
}
