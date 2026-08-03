"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MATCHES, type IMatch, type TMatchState } from "@/lib/tournament/data";

interface IMatchesContextValue {
  matches: IMatch[];
  /** Referee write path (local-only for Phase 1 — becomes a Supabase mutation in Phase 4). */
  updateScore: (id: string, sa: number, sb: number, state: TMatchState) => void;
}

const MatchesContext = createContext<IMatchesContextValue | undefined>(undefined);

// MOCK ONLY: matches the design's default `tickerSpeed` prop (4.5s). Drives a fake live-score
// bump so the home page has visual life ahead of realtime. TODO(Phase 4): delete this effect
// once matches are updated via Supabase realtime subscriptions instead.
const MOCK_TICKER_INTERVAL_MS = 4500;

export function MatchesProvider({ children }: { children: ReactNode }) {
  const [matches, setMatches] = useState<IMatch[]>(() => MATCHES.map((m) => ({ ...m })));

  const updateScore = useCallback((id: string, sa: number, sb: number, state: TMatchState) => {
    setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, sa, sb, state } : m)));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setMatches((prev) =>
        prev.map((m) => {
          if (m.state !== "live") return m;
          if (m.sa >= 21 || m.sb >= 21) return m;
          const bump: "sa" | "sb" = Math.random() < 0.5 ? "sa" : "sb";
          return { ...m, [bump]: m[bump] + 1 };
        }),
      );
    }, MOCK_TICKER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return <MatchesContext.Provider value={{ matches, updateScore }}>{children}</MatchesContext.Provider>;
}

export function useMatches(): IMatchesContextValue {
  const ctx = useContext(MatchesContext);
  if (!ctx) {
    throw new Error("useMatches must be used within a MatchesProvider");
  }
  return ctx;
}
