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

/** Which side won a finished match; null for non-done or a tie. */
export function matchWinnerSide(state: string, sa: number, sb: number): "a" | "b" | null {
  if (state !== "done") return null;
  if (sa > sb) return "a";
  if (sb > sa) return "b";
  return null;
}

/** Strip every non-digit from raw input; used to sanitize the editable score field as the user types. */
export function sanitizeScoreDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Parse a typed score field into the integer to commit. Non-digits are stripped first,
 * an empty field commits as 0, and the result is never negative.
 */
export function parseScoreInput(raw: string): number {
  const digits = sanitizeScoreDigits(raw);
  if (digits === "") return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}
