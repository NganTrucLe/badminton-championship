"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import type { ISystemUser } from "@/lib/tournament/mvp";

// Organizer-only: everyone who has signed in at least once. Empty for non-organizers.
export async function listSystemUsers(): Promise<ISystemUser[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("list_system_users");
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatar_url,
  }));
}

// The caller's own current picks (or nulls), so the vote UI can pre-select them for editing.
export async function getMyMvpVote(): Promise<{ maleId: string | null; femaleId: string | null }> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("get_my_mvp_vote");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { gender: string; candidate_id: string }[];
  return {
    maleId: rows.find((r) => r.gender === "male")?.candidate_id ?? null,
    femaleId: rows.find((r) => r.gender === "female")?.candidate_id ?? null,
  };
}

export async function castMvpVote(maleId: string, femaleId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("cast_mvp_vote", {
    p_male_id: maleId, p_female_id: femaleId,
  });
  if (error) throw new Error(error.message);
}

export async function openMvpVote(minutes: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("open_mvp_vote", { p_minutes: minutes });
  if (error) throw new Error(error.message);
}

export async function closeMvpVote(): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("close_mvp_vote");
  if (error) throw new Error(error.message);
}

export async function resetMvpVote(): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("reset_mvp_vote");
  if (error) throw new Error(error.message);
}

export async function getMvpVoterAllowlist(): Promise<string[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("mvp_voter_allowlist").select("email").order("email");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.email);
}

// Emails are stored lower-cased/trimmed so they always match lower(auth.jwt()->>'email').
// Returns "denied" when RLS filters the write to 0 rows (non-organizer), mirroring
// the codebase convention of treating an empty write result as "no permission".
export async function addMvpVoter(email: string): Promise<"ok" | "denied"> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("mvp_voter_allowlist").insert({ email: email.trim().toLowerCase() }).select();
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? "ok" : "denied";
}

export async function removeMvpVoter(email: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase
    .from("mvp_voter_allowlist").delete().eq("email", email.trim().toLowerCase());
  if (error) throw new Error(error.message);
}
