import type { BadgeProps } from "@/components/ui/badge";

/**
 * Six-Tier Evidence State Machine (technical spec Part V §13).
 *
 * INTERNAL GOVERNANCE MODEL ONLY. These tiers describe review progress inside DRISTI-NET; they are not a
 * statutory classification and say nothing about legal admissibility (docs/context.md §2.2, §16).
 * NOTE: the backend does not yet emit a tier per edge, so no projected edge currently carries one
 * (see audit/BUG_AND_DEFECT_REGISTER.md DEF-020).
 * Tier 1 (RAW_ARTIFACT) is intentionally excluded — it is never rendered
 * as a graph relationship or an evidentiary badge; it exists only as an
 * unparsed, hashed byte stream in raw storage.
 *
 * This is the single source of truth for tier → label/tone/description.
 * The (Phase 2) GraphEngine will consume the same table for edge styling,
 * so the graph and this badge can never visually disagree about a tier.
 */
export type EvidenceTier = 2 | 3 | 4 | 5 | 6;

export interface EvidenceTierConfig {
  tier: EvidenceTier;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  tone: NonNullable<BadgeProps["tone"]>;
  /** Graph edge visual language — used identically here and by the future GraphEngine. */
  lineStyle: "dotted" | "dashed" | "solid" | "solid-glow";
  lineWidth: number;
  opacity: number;
}

export const EVIDENCE_TIER_CONFIG: Record<EvidenceTier, EvidenceTierConfig> = {
  2: {
    tier: 2,
    code: "MACHINE_EXTRACTED",
    label: "Machine Extracted",
    shortLabel: "Tier 2",
    description:
      "Automated candidate extraction. Single-source, algorithmic confidence \u2265 0.60. Not yet corroborated or reviewed.",
    tone: "amber",
    lineStyle: "dotted",
    lineWidth: 1,
    opacity: 0.4,
  },
  3: {
    tier: 3,
    code: "CORROBORATED",
    label: "Corroborated",
    shortLabel: "Tier 3",
    description:
      "Extracted across \u2265 2 distinct evidentiary sources with combined confidence \u2265 0.85. Not yet analyst-signed.",
    tone: "orange",
    lineStyle: "dashed",
    lineWidth: 2,
    opacity: 0.7,
  },
  4: {
    tier: 4,
    code: "ANALYST_VALIDATED",
    label: "Analyst Validated",
    shortLabel: "Tier 4",
    description:
      "Explicit human-in-the-loop review and sign-off by the assigned Investigating Officer.",
    tone: "blue",
    lineStyle: "solid",
    lineWidth: 2,
    opacity: 0.9,
  },
  5: {
    tier: 5,
    code: "SUPERVISOR_VERIFIED",
    label: "Supervisor Verified",
    shortLabel: "Tier 5",
    description:
      "Reviewed and confirmed by a supervisory reviewer. Sharing beyond the case remains subject to separate authorization.",
    tone: "emerald",
    lineStyle: "solid",
    lineWidth: 3,
    opacity: 1,
  },
  6: {
    tier: 6,
    code: "INTEGRITY_REFERENCED_EXPORT",
    label: "Integrity-Referenced Export",
    shortLabel: "Tier 6",
    description:
      "Supervisor-reviewed and packaged with integrity references (SHA-256 manifest, Merkle root). An integrity reference is not proof of authenticity or legal admissibility.",
    tone: "purple",
    lineStyle: "solid-glow",
    lineWidth: 4,
    opacity: 1,
  },
};

export const EVIDENCE_TIER_ORDER: EvidenceTier[] = [2, 3, 4, 5, 6];
