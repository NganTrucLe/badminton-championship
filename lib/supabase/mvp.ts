import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/client";
import { createAuthServerClient } from "@/lib/supabase/serverClient";
import {
  effectiveStatus,
  tallyBallots,
  type IMvpCandidate,
  type IMvpResults,
  type IMvpStatus,
  type TGender,
  type TMvpStatus,
} from "@/lib/tournament/mvp";
import type { TTier } from "@/lib/tournament/data";

// --- Server reads --------------------------------------------------------

export async function getMvpCandidates(): Promise<IMvpCandidate[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, name, tier, gender, avatar_key, avatar_url")
    .not("gender", "is", null)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Failed to load MVP candidates: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    gender: p.gender as TGender,
    tier: p.tier as TTier,
    avatarKey: p.avatar_key,
    avatarUrl: p.avatar_url,
  }));
}

// Uses the cookie-aware client so eligibility/hasVoted reflect the signed-in user
// (anon visitors simply get is_eligible=false, has_voted=false).
export async function getMvpStatus(): Promise<IMvpStatus> {
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.rpc("get_mvp_status");
  if (error) throw new Error(`Failed to load MVP status: ${error.message}`);
  const raw = data as {
    status: TMvpStatus;
    deadline: string | null;
    voted_count: number;
    total_eligible: number;
    is_eligible: boolean;
    has_voted: boolean;
  };
  return {
    status: effectiveStatus(raw.status, raw.deadline, new Date()),
    deadline: raw.deadline,
    votedCount: raw.voted_count,
    totalEligible: raw.total_eligible,
    isEligible: raw.is_eligible,
    hasVoted: raw.has_voted,
  };
}

// Resolve candidates by id ignoring deleted_at — used so a candidate soft-deleted AFTER voting
// still appears in results (their votes must not silently vanish and flip the winner).
async function getPlayersByIds(ids: string[]): Promise<IMvpCandidate[]> {
  if (ids.length === 0) return [];
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, name, tier, gender, avatar_key, avatar_url")
    .in("id", ids)
    .not("gender", "is", null);
  if (error) throw new Error(`Failed to resolve candidates: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id, name: p.name, gender: p.gender as TGender, tier: p.tier as TTier,
    avatarKey: p.avatar_key, avatarUrl: p.avatar_url,
  }));
}

// Returns male/female results with winners once the vote is closed; the RPC returns no rows
// while idle/open, which tallies to zero winners (a "no winner yet" render).
export async function getMvpResults(): Promise<IMvpResults | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_mvp_results");
  if (error) throw new Error(`Failed to load MVP results: ${error.message}`);
  const rows = (data ?? []) as { gender: TGender; candidate_id: string; votes: number }[];

  // Union of current candidates (so zero-vote ones still show) + any balloted candidate that
  // is no longer in the live candidate set (soft-deleted), so no votes are dropped.
  const current = await getMvpCandidates();
  const missing = Array.from(new Set(rows.map((r) => r.candidate_id)))
    .filter((id) => !current.some((c) => c.id === id));
  const candidates = [...current, ...(await getPlayersByIds(missing))];

  return tallyBallots(
    candidates,
    rows.map((r) => ({ gender: r.gender, candidateId: r.candidate_id, votes: Number(r.votes) })),
  );
}
