"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

// Re-fetches get_mvp_status whenever a receipt row changes, so the referee sees
// turnout climb live. Organizer has SELECT on mvp_receipts, so realtime delivers.
export function useMvpTurnout(initialVoted: number, initialTotal: number) {
  const [votedCount, setVotedCount] = useState(initialVoted);
  const [totalEligible, setTotalEligible] = useState(initialTotal);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let active = true;
    const refresh = async () => {
      const { data } = await supabase.rpc("get_mvp_status");
      if (!active || !data) return;
      const raw = data as { voted_count: number; total_eligible: number };
      setVotedCount(raw.voted_count);
      setTotalEligible(raw.total_eligible);
    };
    const channel = supabase
      .channel("public:mvp_receipts")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "mvp_receipts" },
        () => { void refresh(); })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { votedCount, totalEligible };
}
