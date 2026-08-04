"use server";

import { createAuthServerClient } from "@/lib/supabase/serverClient";
import { getMatches, getPairCodeToId } from "@/lib/supabase/tournament";
import { generateNextRound } from "@/lib/tournament/swissPairing";
import { teamIdToLetter } from "@/lib/tournament/data";

/**
 * Organizer-guarded Server Action: computes and inserts the next Swiss round's matches once the
 * current round is fully complete. Idempotent — safe to call repeatedly (e.g. after every match
 * end): it only inserts when a next round is actually due and doesn't already exist.
 *
 * BYE = SIT OUT (approved rule, .memory/knowledge/swiss-format.md): a bye pair plays no match and
 * its record is unchanged, so `result.bye` is intentionally never turned into a row here — no
 * synthetic opponent, no free win, nothing to insert.
 */
export async function ensureNextRound(): Promise<{ generated: boolean; round?: number }> {
  const supabase = await createAuthServerClient();

  // Organizer gate (defense-in-depth; RLS on matches INSERT also enforces it).
  const { data: isOrg } = await supabase.rpc("is_organizer");
  if (isOrg !== true) return { generated: false };

  const matches = await getMatches();
  const result = generateNextRound(matches);
  if (!result) return { generated: false };

  // Idempotency: if the target round already has matches, do nothing.
  if (matches.some((m) => m.round === result.round)) return { generated: false };

  const codeToId = await getPairCodeToId();
  const rows = result.pairs.map((p, i) => ({
    code: `R${result.round}-${i + 1}`,
    round_n: result.round,
    court: (i % 2) + 1,
    time_label: "",
    pair_a_id: codeToId[teamIdToLetter(p.aTeamId)],
    pair_b_id: codeToId[teamIdToLetter(p.bTeamId)],
    score_a: 0,
    score_b: 0,
    state: "next" as const,
  }));

  const { error } = await supabase.from("matches").insert(rows).select();
  if (error) {
    // RLS rejection (non-organizer) or constraint error — surface false, let caller retry later.
    return { generated: false };
  }

  // result.bye is a SIT OUT per the approved rule: no match row, no record change — deliberately
  // no insert here for the bye pair.

  return { generated: true, round: result.round };
}
