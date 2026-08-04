import "server-only";
import { createServerSupabaseClient } from "./client";
import type { Database } from "./database.types";
import type { IMatch, IPlayer, IRoundMeta, ITeam, TMatchState, TTier } from "@/lib/tournament/data";

type TPlayerRow = Pick<Database["public"]["Tables"]["players"]["Row"], "id" | "name" | "tier" | "avatar_key" | "avatar_url">;
type TPairRow = Pick<
  Database["public"]["Tables"]["pairs"]["Row"],
  "id" | "code" | "name" | "player1_id" | "player2_id"
>;
type TRoundRow = Pick<Database["public"]["Tables"]["rounds"]["Row"], "n" | "title" | "time_label" | "sub">;
type TMatchRow = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  "code" | "round_n" | "court" | "time_label" | "pair_a_id" | "pair_b_id" | "score_a" | "score_b" | "state"
>;

function toPlayer(row: TPlayerRow): IPlayer {
  return {
    name: row.name,
    tier: row.tier as TTier,
    avatarKey: row.avatar_key ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
  };
}

/**
 * Reads pairs + players from Supabase and maps them into the same `ITeam[]` shape the app
 * already consumes (see lib/tournament/data.ts). The Swiss `id` used everywhere downstream is
 * derived from the pair's letter `code` (A=1 .. H=8) so `standings.ts` — which is not touched by
 * this phase — keeps working unmodified against numeric team ids.
 */
export async function getTeams(): Promise<ITeam[]> {
  const supabase = createServerSupabaseClient();

  const { data: pairs, error: pairsError } = await supabase
    .from("pairs")
    .select("id, code, name, player1_id, player2_id")
    .is("deleted_at", null)
    .order("code", { ascending: true });
  if (pairsError) {
    throw new Error(`Failed to load pairs: ${pairsError.message}`);
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, tier, avatar_key, avatar_url")
    .is("deleted_at", null);
  if (playersError) {
    throw new Error(`Failed to load players: ${playersError.message}`);
  }

  const playersById = new Map<string, TPlayerRow>((players ?? []).map((p) => [p.id, p]));

  return (pairs ?? []).map((pair: TPairRow) => {
    const p1 = playersById.get(pair.player1_id);
    const p2 = playersById.get(pair.player2_id);
    if (!p1 || !p2) {
      throw new Error(`Pair ${pair.code} references a missing player`);
    }
    return {
      id: letterToTeamId(pair.code),
      letter: pair.code,
      name: pair.name,
      players: [toPlayer(p1), toPlayer(p2)] as [IPlayer, IPlayer],
    };
  });
}

/** Reads rounds from Supabase into the same `IRoundMeta[]` shape as ROUND_META. */
export async function getRoundMeta(): Promise<IRoundMeta[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("rounds")
    .select("n, title, time_label, sub")
    .is("deleted_at", null)
    .order("n", { ascending: true });
  if (error) {
    throw new Error(`Failed to load rounds: ${error.message}`);
  }
  return (data ?? []).map((r: TRoundRow) => ({
    n: r.n,
    title: r.title,
    time: r.time_label,
    sub: r.sub,
  }));
}

/**
 * Reads matches from Supabase into the same `IMatch[]` shape as MATCHES. `a`/`b` are numeric
 * team ids derived from the pairs' letter codes (see letterToTeamId), matching the existing
 * `standings.ts` contract exactly.
 */
export async function getMatches(): Promise<IMatch[]> {
  const supabase = createServerSupabaseClient();

  const { data: pairs, error: pairsError } = await supabase.from("pairs").select("id, code").is("deleted_at", null);
  if (pairsError) {
    throw new Error(`Failed to load pairs: ${pairsError.message}`);
  }
  const pairCodeById = new Map<string, string>((pairs ?? []).map((p) => [p.id, p.code]));

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("code, round_n, court, time_label, pair_a_id, pair_b_id, score_a, score_b, state")
    .is("deleted_at", null)
    .order("code", { ascending: true });
  if (matchesError) {
    throw new Error(`Failed to load matches: ${matchesError.message}`);
  }

  return (matches ?? []).map((m: TMatchRow) => {
    const aCode = pairCodeById.get(m.pair_a_id);
    const bCode = pairCodeById.get(m.pair_b_id);
    if (!aCode || !bCode) {
      throw new Error(`Match ${m.code} references a missing pair`);
    }
    return {
      id: m.code,
      round: m.round_n,
      court: m.court,
      time: m.time_label,
      a: letterToTeamId(aCode),
      b: letterToTeamId(bCode),
      sa: m.score_a,
      sb: m.score_b,
      state: m.state as TMatchState,
    };
  });
}

/** 'A' -> 1, 'B' -> 2, ... matching the existing TEAMS[].id ordering in lib/tournament/data.ts. */
function letterToTeamId(letter: string): number {
  return letter.trim().toUpperCase().charCodeAt(0) - "A".charCodeAt(0) + 1;
}

/**
 * Maps a pair's DB uuid to its numeric Swiss team id (see letterToTeamId). Realtime
 * `postgres_changes` payloads on `matches` only carry `pair_a_id`/`pair_b_id` (uuids), not the
 * pair's letter code — client islands (Phase 4) need this map to translate a raw realtime row
 * back into the app's `IMatch` shape without an extra round-trip per event.
 */
export async function getPairIdToTeamId(): Promise<Record<string, number>> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("pairs").select("id, code").is("deleted_at", null);
  if (error) {
    throw new Error(`Failed to load pairs: ${error.message}`);
  }
  const map: Record<string, number> = {};
  (data ?? []).forEach((p: { id: string; code: string }) => {
    map[p.id] = letterToTeamId(p.code);
  });
  return map;
}
