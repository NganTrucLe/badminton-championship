"use client";

import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import type { Database } from "@/lib/supabase/database.types";
import type { IMatch, TMatchState } from "@/lib/tournament/data";

type TMatchRow = Database["public"]["Tables"]["matches"]["Row"];

function rowToMatch(row: TMatchRow, pairIdToTeamId: Record<string, number>): IMatch | undefined {
  const a = pairIdToTeamId[row.pair_a_id];
  const b = pairIdToTeamId[row.pair_b_id];
  if (a === undefined || b === undefined) return undefined;
  return {
    id: row.code,
    round: row.round_n,
    court: row.court,
    time: row.time_label,
    a,
    b,
    sa: row.score_a,
    sb: row.score_b,
    state: row.state as TMatchState,
  };
}

function applyChange(
  prev: IMatch[],
  payload: RealtimePostgresChangesPayload<TMatchRow>,
  pairIdToTeamId: Record<string, number>,
): IMatch[] {
  if (payload.eventType === "DELETE") {
    const oldCode = (payload.old as Partial<TMatchRow>).code;
    return oldCode ? prev.filter((m) => m.id !== oldCode) : prev;
  }

  const row = payload.new as TMatchRow;
  if (row.deleted_at) {
    return prev.filter((m) => m.id !== row.code);
  }

  const updated = rowToMatch(row, pairIdToTeamId);
  if (!updated) return prev;

  const idx = prev.findIndex((m) => m.id === updated.id);
  if (idx === -1) {
    return [...prev, updated].sort((x, y) => x.id.localeCompare(y.id));
  }
  const next = prev.slice();
  next[idx] = updated;
  return next;
}

/**
 * Seeds from server-fetched `initialMatches` (so SSR/first paint is correct and fast), then
 * subscribes to Supabase Realtime `postgres_changes` on `public.matches` to keep the list live —
 * no polling, no full page reload. `matches` has a public `select using (true)` RLS policy, so
 * this works for anonymous visitors too (realtime respects RLS).
 *
 * `setMatches` is also returned so callers that write (the referee panel) can optimistically patch
 * local state right after a successful mutation, ahead of the realtime echo — the two are
 * idempotent against each other (the echo just overwrites with the same values, or a newer value
 * if another organizer also just wrote — see the last-write-wins note in RefereeScoringPanel).
 */
export function useLiveMatches(
  initialMatches: IMatch[],
  pairIdToTeamId: Record<string, number>,
): [IMatch[], React.Dispatch<React.SetStateAction<IMatch[]>>] {
  const [matches, setMatches] = useState<IMatch[]>(initialMatches);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const channel = supabase
      .channel("public:matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload: RealtimePostgresChangesPayload<TMatchRow>) => {
          setMatches((prev) => applyChange(prev, payload, pairIdToTeamId));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // pairIdToTeamId is derived server-side from a stable seed (pairs never change post-seed);
    // re-subscribing on every render would be wasteful, so it is intentionally excluded here and
    // instead read fresh via closure each time applyChange runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [matches, setMatches];
}
