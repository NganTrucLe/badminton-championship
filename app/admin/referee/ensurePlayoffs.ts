"use server";

import { createAuthServerClient } from "@/lib/supabase/serverClient";
import { getMatches, getPairCodeToId, getTeams } from "@/lib/supabase/tournament";
import { generateSemis, generateFinals, type IPlayoffRow } from "@/lib/tournament/playoffs";
import { teamIdToLetter } from "@/lib/tournament/data";

/**
 * Organizer-guarded Server Action song song với ensureNextRound: khi 4 đội qualified thì chèn 2
 * bán kết (round 6); khi 2 bán kết done thì chèn chung kết + hạng 3 (round 7). Idempotent — engine
 * trả null nếu round tương ứng đã tồn tại.
 */
export async function ensurePlayoffs(): Promise<{ generated: "semis" | "finals" | null }> {
  const supabase = await createAuthServerClient();
  const { data: isOrg } = await supabase.rpc("is_organizer");
  if (isOrg !== true) return { generated: null };

  const [matches, teams, codeToId] = await Promise.all([getMatches(), getTeams(), getPairCodeToId()]);

  const insertRows = async (rows: IPlayoffRow[]) => {
    const payload = rows.map((r) => ({
      code: r.code,
      round_n: r.round,
      court: r.court,
      time_label: "",
      pair_a_id: codeToId[teamIdToLetter(r.aTeamId)],
      pair_b_id: codeToId[teamIdToLetter(r.bTeamId)],
      score_a: 0,
      score_b: 0,
      state: "next" as const,
    }));
    const { error } = await supabase.from("matches").insert(payload).select();
    if (error) {
      console.error(`[ensurePlayoffs] insert round ${rows[0]?.round} failed:`, error.message);
      return false;
    }
    return true;
  };

  const semis = generateSemis(matches, teams);
  if (semis) return { generated: (await insertRows(semis)) ? "semis" : null };

  const finals = generateFinals(matches);
  if (finals) return { generated: (await insertRows(finals)) ? "finals" : null };

  return { generated: null };
}
