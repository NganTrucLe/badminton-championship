import type { TMatchState } from "@/lib/tournament/data";

/**
 * Pure state-machine decisions for the referee scoring panel.
 * Extracted so the lock-to-live / single-action / score-controls rules
 * are unit-testable independently of the JSX.
 */

/**
 * Which single primary action (if any) the scoreboard should offer for a
 * match in the given state. Never both — "next" only offers Start, "live"
 * only offers End, "done" offers nothing (a done match cannot be re-acted on
 * from the primary action — only reset, which is a separate control).
 */
export function primaryAction(state: TMatchState): "start" | "end" | "none" {
  if (state === "next") return "start";
  if (state === "live") return "end";
  return "none";
}

/**
 * A match is selectable by the referee when either:
 * - no match is currently live, and this match is "next" (awaiting start), or
 * - this match IS the live match (so the locked-in match stays clickable/highlighted).
 *
 * "done" matches are never selectable, and while any match is live, every
 * other match (regardless of state) is locked out.
 */
export function isSelectable(match: { id: string; state: TMatchState }, liveMatch: { id: string } | undefined): boolean {
  if (liveMatch) return match.id === liveMatch.id;
  return match.state === "next";
}

/** The ± score controls render only while the active match is live. */
export function showScoreControls(state: TMatchState): boolean {
  return state === "live";
}
