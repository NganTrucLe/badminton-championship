"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getTeam as staticGetTeam, type ITeam } from "./data";

const TeamLookupContext = createContext<Map<number, ITeam> | null>(null);

export function TeamLookupProvider({ teams, children }: { teams: ITeam[]; children: ReactNode }) {
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  return <TeamLookupContext.Provider value={byId}>{children}</TeamLookupContext.Provider>;
}

/** Resolve a team by id from live data; falls back to the static seed if unavailable. */
export function useTeamLookup(): (id: number) => ITeam {
  const byId = useContext(TeamLookupContext);
  return (id: number) => byId?.get(id) ?? staticGetTeam(id);
}
