import "server-only";
import { createAuthServerClient } from "./serverClient";
import type { TTier } from "@/lib/tournament/data";

export interface IAdminPlayer {
  id: string;
  name: string;
  tier: TTier;
  gender: "male" | "female" | null;
  avatarKey: string | null;
  avatarUrl: string | null;
}

export interface IAdminPair {
  id: string;
  code: string;
  name: string;
  player1Id: string;
  player2Id: string;
}

/** Reads all players for the admin editors. Auth server client — runs under the organizer session. */
export async function getAdminPlayers(): Promise<IAdminPlayer[]> {
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, name, tier, gender, avatar_key, avatar_url")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`Failed to load players: ${error.message}`);
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier as TTier,
    gender: p.gender as "male" | "female" | null,
    avatarKey: p.avatar_key,
    avatarUrl: p.avatar_url,
  }));
}

/** Reads all pairs for the admin editors. Auth server client — runs under the organizer session. */
export async function getAdminPairs(): Promise<IAdminPair[]> {
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase
    .from("pairs")
    .select("id, code, name, player1_id, player2_id")
    .is("deleted_at", null)
    .order("code", { ascending: true });
  if (error) {
    throw new Error(`Failed to load pairs: ${error.message}`);
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    player1Id: p.player1_id,
    player2Id: p.player2_id,
  }));
}
