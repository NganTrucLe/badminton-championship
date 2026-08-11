# Live Team Names Across Schedule / Home / Referee — Fix Plan

**Goal:** Every screen that shows team names, players, and avatars must reflect the **live** pairs (edited đội hình), not the hardcoded `TEAMS` seed. Today only `/teams` reads live data; `/schedule`, the home live/recent blocks, and the referee UI resolve names from the static `TEAMS` array in `lib/tournament/data.ts`, so they never update after a pair edit.

**Root cause:** `lib/tournament/standings.ts` (and two `TeamAvatars` helpers) resolve identity via `TEAMS` / `getTeam(id)` / `teamName(id)` / `teamPlayersLabel(id)`. These are static. Team **ids/letters are stable** (A–H → 1–8); only **name/players** vary with edits.

**Approach:** Thread live `teams: ITeam[]` (from `getTeams()`) into the standings functions (fixes all name/player *text*), and add a small React context so the `TeamAvatars` helpers resolve live *players/avatars*. Keep static `TEAMS` only as a fallback. Server pages already fetch matches; add `getTeams()` and pass a `teams` prop to each client island.

## Files

- **Create** `lib/tournament/teamLookup.tsx` — client `TeamLookupProvider` + `useTeamLookup()` (live byId map, static fallback).
- **Modify** `lib/tournament/standings.ts` — add `teams: ITeam[]` param to the name-resolving functions; resolve via a `byId` map instead of `TEAMS`/`teamName`/`teamPlayersLabel`/`getTeam`.
- **Modify** `lib/tournament/__tests__/standings.test.ts` — pass `TEAMS` as the `teams` arg (assertions unchanged); add one test proving a *renamed* team flows through.
- **Modify** `app/schedule/ScheduleBoard.tsx` — accept `teams` prop; pass to standings; wrap in `TeamLookupProvider`; `TeamAvatars` uses `useTeamLookup()`.
- **Modify** `app/schedule/page.tsx` — fetch `getTeams()`, pass `teams`.
- **Modify** `app/HomeLiveSection.tsx` — accept `teams` prop; pass to `computeLiveMatch`/`computeRecentResults` (text only, no avatars).
- **Modify** `app/page.tsx` — fetch `getTeams()`, pass `teams` to `HomeLiveSection`.
- **Modify** `app/admin/referee/RefereeScoringPanel.tsx` — accept `teams` prop; wrap in `TeamLookupProvider`; replace `teamName(...)`/`getTeam(...).players` with `useTeamLookup()`; pass `teams` to `RefereeSwissPicker`.
- **Modify** `app/admin/referee/RefereeSwissPicker.tsx` — accept `teams` prop; pass to standings; `TeamAvatars` uses `useTeamLookup()`.
- **Modify** `app/admin/referee/page.tsx` — fetch `getTeams()`, pass `teams`.

## API changes (standings.ts)

Add `teams: ITeam[]` and resolve via `const byId = new Map(teams.map(t => [t.id, t]))`:

- `buildTeamRecords(matches, teams)` — enumerate `teams` instead of `TEAMS` for the zeroed table.
- `computeStandingsTable(records, teams)` — `name`/`players` from `byId`.
- `computeLiveMatch(matches, teams)` — names/players from `byId`.
- `computeRecentResults(matches, teams)` — names from `byId`.
- `computeQualified(records, teams)` / `computeEliminated(records, teams)` — filter over `teams`; `teamChip` takes `byId`.
- `computeSwissColumns(matches, records, teams)` — enumerate `teams`; `matchDisplay(m, byId)` and `teamChip(id, records, byId)`.
- `computeTrackRows(records, teams)` — map over `teams`; `name`/`letter` from each team.
- `computeSemis(qualified)` — **unchanged** (uses chip data already carrying live names).

Internal helpers become `teamChip(id, records, byId)` and `matchDisplay(m, byId)`.

Players label helper (was `teamPlayersLabel(id)`): `byId.get(id)!.players.map(p => p.name).join(" & ")`.

## teamLookup.tsx

```tsx
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
```

## Test strategy

- Existing `standings.test.ts` cases keep their assertions but pass `TEAMS` as the new `teams` arg (static names identical → green). Import `TEAMS` from `../data`.
- Add one test: build a modified `ITeam[]` (e.g. rename team id 1 to "X – Y") and assert `computeRecentResults(MATCHES, modifiedTeams)` / `computeSwissColumns` yield the new name — locks the live-name path.
- Full suite (`npm run test`) and `npm run build` must pass. Referee/home/schedule component tests (if any) updated to pass `teams`.

## Risks

- **Signature ripple:** all standings callers must update together (build breaks otherwise) — this is one cohesive change, not incremental.
- **Avatars:** only `TeamAvatars` needs live players; context avoids prop-drilling through `SwissMatchCard`/chip components.
- **Fallback:** `useTeamLookup` falls back to static seed if no provider — keeps any un-wrapped usage from crashing, but every island must wrap its tree so live data actually wins.
- **swissPairing.ts** uses `TEAMS` only to enumerate the 8 stable ids for generation — **not** name display — so it is intentionally left unchanged.
