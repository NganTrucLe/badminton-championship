"use server";

import { createAuthServerClient } from "@/lib/supabase/serverClient";
import { generateRoundOne } from "@/lib/tournament/roundOne";

/**
 * Organizer-guarded Server Action: rebuilds the round-1 match list from the current pairs
 * (đội hình), paired adjacently by code. Deletes every existing match row and inserts a fresh
 * round 1 with zeroed scores. Only usable in setup phase (enforced by RLS: the DELETE policy is
 * setup-gated). Invoked by the "Gửi đội hình & bắt đầu giải" flow before start_tournament().
 */
export async function regenerateRoundOne(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAuthServerClient();

  const { data: isOrg } = await supabase.rpc("is_organizer");
  if (isOrg !== true) return { ok: false, error: "not authorized" };

  const { data: pairs, error: pairsError } = await supabase
    .from("pairs")
    .select("id, code")
    .is("deleted_at", null);
  if (pairsError) return { ok: false, error: pairsError.message };
  if (!pairs || pairs.length !== 8) {
    return { ok: false, error: "roster incomplete: expected 8 pairs" };
  }

  const codeToId = new Map(pairs.map((p) => [p.code, p.id]));

  let rows;
  try {
    rows = generateRoundOne(pairs.map((p) => p.code)).map((mm) => ({
      code: mm.code,
      round_n: 1,
      court: mm.court,
      time_label: mm.time,
      pair_a_id: codeToId.get(mm.aCode)!,
      pair_b_id: codeToId.get(mm.bCode)!,
      score_a: 0,
      score_b: 0,
      state: "next" as const,
    }));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Qualified delete (pg_safeupdate + PostgREST both require a filter). All match rows have
  // round_n >= 1, so this clears the whole schedule before reseeding round 1.
  const { error: delError } = await supabase.from("matches").delete().gte("round_n", 1);
  if (delError) return { ok: false, error: delError.message };

  const { error: insError } = await supabase.from("matches").insert(rows);
  if (insError) return { ok: false, error: insError.message };

  return { ok: true };
}
