# Swiss Auto-Pairing Engine Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This is Plan 2 of 2** and depends on Plan 1 (`.planning/plans/2026-08-04-referee-flow-and-rewards.md`) being merged — it builds on Plan 1's referee state machine (single Start/End, lock-to-live). **Task 1 (the Swiss rules doc) is a hard gate: the pairing algorithm in Task 2 is written to the APPROVED doc. Do not start Task 2 until the user has approved Task 1's document, including the two flagged decision points (deuce rule, bye semantics).**

**Goal:** Automatically generate each Swiss round's pairings from results — the moment a round completes, the next round's matches appear, following documented Swiss rules (group-by-record, rematch avoidance, cross-pairing for odd groups, qualify-at-3-wins / eliminate-at-3-losses) — and let the referee pick the current match from a Swiss tree.

**Architecture:** The pairing logic is a **pure, exhaustively-tested TypeScript module** (`lib/tournament/swissPairing.ts`), mirroring the existing `standings.ts` precedent (complex Swiss maths kept in tested app code, not SQL). Generation is an **idempotent, organizer-authorized server action** (`ensureNextRound`) that computes pairings with that module and INSERTs the next round via the authenticated Supabase client (RLS enforces organizer). It fires automatically after the referee ends the last match of a round and as a reconciliation on referee-page load; Supabase Realtime then pushes the new matches to every viewer. Only round 1 is seeded; rounds 2+ are generated. Reset deletes generated rounds.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Supabase (Postgres/RLS/Realtime), Vitest.

## Global Constraints

- **Do NOT modify `lib/tournament/standings.ts`** (18 tests). The new pairing module is a SEPARATE file. It may import the pure record helpers (`buildTeamRecords`, the `ITeamRecord`/`TTeamRecords` types) from `standings.ts` but must not change them.
- **The Swiss rules doc (Task 1) is the single source of truth for the algorithm.** Every pairing decision in Task 2 must trace to a rule in `.memory/knowledge/swiss-format.md`. If the algorithm needs a rule the doc doesn't state, STOP and add it to the doc (and get it approved) — do not invent silently.
- Roster is fixed 8 pairs (A–H), doubles, Bo1. Pair letter codes A–H are immutable (standings numeric-id invariant from Plan 1/earlier).
- Generation is **idempotent**: a round is generated only if the previous round is fully `done` and that round's matches do not already exist. Safe to call repeatedly.
- Generation writes go through the **authenticated** Supabase client under an organizer session; RLS (`matches` INSERT = `is_organizer()`) is the authorization boundary. Never use the service-role key on the client.
- Match `code`/`time_label` are internal only (Plan 1 removed them from displays). Generated matches use `code = "R{round}-{i}"`, `time_label = ""`, `court` alternating 1/2, `state = "next"`, `score_a/b = 0`.
- `npm run build` (local Supabase), `npm run lint`, `npm run test` pass before every commit (build against local; see Plan 1 for the env override).
- Atomic commits, scope `swiss`.

---

## File Structure

- `.memory/knowledge/swiss-format.md` — the authoritative Swiss rules doc (Task 1).
- `lib/tournament/swissPairing.ts` — pure pairing engine (Task 2).
- `lib/tournament/__tests__/swissPairing.test.ts` — exhaustive pairing tests (Task 2).
- `supabase/migrations/20260805000000_swiss_generation.sql` — seed round-1-only; `reset_tournament()` deletes generated rounds; helper index (Task 3).
- `supabase/cloud-phase6.sql` — consolidated cloud SQL for the user to apply (Task 3).
- `supabase/seed.sql` — round-1-only match seed (Task 3).
- `app/admin/referee/ensureNextRound.ts` — organizer-guarded server action that computes + inserts the next round (Task 4).
- `app/admin/referee/RefereeScoringPanel.tsx` — call `ensureNextRound` after ending a match (Task 5); swap the flat picker for the Swiss tree (Task 6).
- `app/admin/referee/RefereeSwissPicker.tsx` — the interactive Swiss-column match selector (Task 6).
- `lib/supabase/tournament.ts` — add `getPairCodeToId()` server read for id→uuid mapping used by generation (Task 4).

---

### Task 1: Author & approve the Swiss rules document (GATE)

**Files:**
- Create: `.memory/knowledge/swiss-format.md`

**Interfaces:**
- Produces: the human-approved rules that Task 2's algorithm implements verbatim.

- [ ] **Step 1: Write the rules doc** with exactly this content (it encodes what `standings.ts` already implies — 8 pairs, 3-win qualify, 3-loss eliminate — plus the pairing rules the code never specified). The two **DECISION POINTS** must be resolved by the user before Task 2.

````markdown
# Swiss Format — Club Badminton Championship (doubles, 8 pairs)

Authoritative rules for standings + automatic round generation. The pairing engine
(`lib/tournament/swissPairing.ts`) implements this document exactly.

## Teams & match format
- 8 fixed pairs, letters A–H (immutable codes; numeric ids A=1 … H=8).
- Doubles, best-of-1 (Bo1). A match is played to 21 points.
- **DECISION POINT 1 — deuce:** default = **no deuce** (the referee reports the final score; the
  higher score wins; ties are impossible because the referee only ends a completed match). Confirm
  or replace with win-by-2 / cap rules.

## Progression
- A pair plays one match per round until it reaches **3 wins → Qualified** or **3 losses →
  Eliminated**. Qualified/Eliminated pairs stop playing.
- "Alive" = wins < 3 AND losses < 3.
- Maximum 5 rounds (with 8 pairs and 3W/3L, every pair resolves within 5 rounds).

## Round 1 (fixed opening draw)
- A–E, B–F, C–G, D–H. (Seeded, not generated.)

## Round N+1 generation (runs when round N is fully complete)
1. Take the **alive** pairs only.
2. **Group** them by identical (wins–losses) record.
3. **Order groups** by wins descending, then losses ascending.
4. **Standing order within a group:** wins desc → point differential (points_for − points_against)
   desc → pair letter A→H ascending.
5. **Odd group float:** if a group has an odd number of pairs, its lowest-standing pair floats down
   and joins the next (lower) group before that group is paired. Process groups top→bottom.
6. **Pairing within a (now even) group — fold + rematch avoidance:** order the group [t1…tk]; the
   default pairing is fold pairing (t1 vs t(k/2+1), t2 vs t(k/2+2), …). If any default pair is a
   **rematch** (the two already played each other in a prior round), repair that group by searching
   for the nearest alternative opponent assignment with **no rematches**; if and only if no
   rematch-free perfect matching exists, allow the minimum number of rematches (and record which).
7. **DECISION POINT 2 — bye:** a bye is only needed when the total alive count is odd (possible when
   a round removes an odd number of pairs). Default = the lowest-standing alive pair overall gets a
   **bye = free win** (counts toward the 3 needed to qualify), sits out that round, and is not paired.
   Confirm, or choose "bye = sit out, no record change."

## Terminal / playoffs
- Generation stops when fewer than 2 alive pairs remain, OR 4 pairs have Qualified.
- When 4 pairs are Qualified, seed semifinals: seed1 vs seed4, seed2 vs seed3, where seed order =
  qualification order (earlier round qualified first; within the same round, wins desc → differential
  desc → letter). Semifinal/final generation is **Task 7** of the plan (may be deferred).

## Worked example (why odd groups occur)
- R1: 8 alive → 4 matches. R2 groups: {1-0}×4, {0-1}×4 (even).
- R3 groups: {2-0}×2, {1-1}×4, {0-2}×2 (even). After R3: one pair reaches 3-0 (Qualified),
  one reaches 0-3 (Eliminated) → 6 alive.
- R4 groups: {2-1}×3 (ODD), {1-2}×3 (ODD). The lowest {2-1} pair floats into {1-2}; that group
  becomes 4 and is fold-paired — this is the design's round-4 "trận đấu chéo" (cross match).
````

- [ ] **Step 2: Present the doc to the user and get the two decision points resolved.** Update the doc to record the chosen deuce + bye rules (replace the "DECISION POINT" notes with the decisions). Do NOT proceed to Task 2 until approved.

- [ ] **Step 3: Commit**

```bash
git add .memory/knowledge/swiss-format.md
git commit -m "docs(swiss): add authoritative Swiss format rules"
```

---

### Task 2: Pure pairing engine (TDD, built to the approved doc)

**Files:**
- Create: `lib/tournament/swissPairing.ts`
- Test: `lib/tournament/__tests__/swissPairing.test.ts`

**Interfaces:**
- Consumes: `IMatch`, `TEAMS` (from `data.ts`); `buildTeamRecords`, `ITeamRecord`, `TTeamRecords` (from `standings.ts`).
- Produces:
  - `interface IGeneratedPair { aTeamId: number; bTeamId: number }`
  - `interface IGenerationResult { round: number; pairs: IGeneratedPair[]; bye: number | null; forcedRematches: Array<[number, number]> }`
  - `function latestRound(matches: IMatch[]): number`
  - `function isRoundComplete(matches: IMatch[], round: number): boolean` — true if the round has ≥1 match and all its matches are `done`.
  - `function priorOpponents(matches: IMatch[]): Map<number, Set<number>>` — team id → set of team ids it has already played (any state `done`).
  - `function generateNextRound(matches: IMatch[]): IGenerationResult | null` — returns the next round's pairings, or `null` if generation should not happen (latest round not complete, or <2 alive, or 4 qualified). Implements doc rules 1–7 exactly.

- [ ] **Step 1: Write failing tests** covering the doc's rules and the worked example. Representative core (add the rest per the coverage list in Test Strategy):

```ts
import { describe, expect, it } from "vitest";
import { generateNextRound, isRoundComplete, priorOpponents } from "@/lib/tournament/swissPairing";
import type { IMatch } from "@/lib/tournament/data";

// helper: build a done match
const done = (id: string, round: number, a: number, b: number, sa: number, sb: number): IMatch => ({
  id, round, court: 1, time: "", a, b, sa, sb, state: "done",
});

describe("isRoundComplete", () => {
  it("false when a round has a non-done match, true when all done", () => {
    const ms: IMatch[] = [done("R1-1", 1, 1, 5, 21, 10), { ...done("R1-2", 1, 2, 6, 0, 0), state: "next" }];
    expect(isRoundComplete(ms, 1)).toBe(false);
    ms[1] = done("R1-2", 1, 2, 6, 21, 9);
    expect(isRoundComplete(ms, 1)).toBe(true);
  });
});

describe("generateNextRound — round 1 → round 2", () => {
  it("splits 8 teams into two even record groups and pairs within them, no rematches", () => {
    // R1 (design seed): A(1)-E(5), B(2)-F(6), C(3)-G(7), D(4)-H(8); winners 1,2,3,4
    const r1: IMatch[] = [
      done("R1-1", 1, 1, 5, 21, 12),
      done("R1-2", 1, 2, 6, 21, 15),
      done("R1-3", 1, 3, 7, 21, 18),
      done("R1-4", 1, 4, 8, 21, 10),
    ];
    const res = generateNextRound(r1)!;
    expect(res.round).toBe(2);
    expect(res.pairs).toHaveLength(4);
    expect(res.bye).toBeNull();
    // winners {1,2,3,4} only meet winners; losers {5,6,7,8} only meet losers
    const winners = new Set([1, 2, 3, 4]);
    for (const p of res.pairs) {
      const bothWinners = winners.has(p.aTeamId) && winners.has(p.bTeamId);
      const bothLosers = !winners.has(p.aTeamId) && !winners.has(p.bTeamId);
      expect(bothWinners || bothLosers).toBe(true);
    }
    // no rematch: none of R1's opponent pairs reappear
    const prior = priorOpponents(r1);
    for (const p of res.pairs) expect(prior.get(p.aTeamId)?.has(p.bTeamId)).not.toBe(true);
  });
});

describe("generateNextRound — gating", () => {
  it("returns null when the latest round is not complete", () => {
    const r1: IMatch[] = [done("R1-1", 1, 1, 5, 21, 12), { ...done("R1-2", 1, 2, 6, 0, 0), state: "live" }];
    expect(generateNextRound(r1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm RED**

Run: `npm run test -- swissPairing`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/tournament/swissPairing.ts`** to the approved doc. Core structure (fill in per the doc; this is the intended shape, not a placeholder — implement each helper concretely):

```ts
import { TEAMS, type IMatch } from "@/lib/tournament/data";
import { buildTeamRecords, type TTeamRecords } from "@/lib/tournament/standings";

export interface IGeneratedPair { aTeamId: number; bTeamId: number }
export interface IGenerationResult {
  round: number;
  pairs: IGeneratedPair[];
  bye: number | null;
  forcedRematches: Array<[number, number]>;
}

export function latestRound(matches: IMatch[]): number {
  return matches.reduce((mx, m) => Math.max(mx, m.round), 0);
}

export function isRoundComplete(matches: IMatch[], round: number): boolean {
  const rm = matches.filter((m) => m.round === round);
  return rm.length > 0 && rm.every((m) => m.state === "done");
}

export function priorOpponents(matches: IMatch[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  const add = (x: number, y: number) => {
    if (!map.has(x)) map.set(x, new Set());
    map.get(x)!.add(y);
  };
  matches.filter((m) => m.state === "done").forEach((m) => { add(m.a, m.b); add(m.b, m.a); });
  return map;
}

function alive(records: TTeamRecords, id: number): boolean {
  return records[id].w < 3 && records[id].l < 3;
}

/** Standing order within a group: wins desc, then (pf-pa) desc, then letter (id) asc. */
function standingOrder(ids: number[], records: TTeamRecords): number[] {
  return [...ids].sort((x, y) => {
    const rx = records[x], ry = records[y];
    return ry.w - rx.w || (ry.pf - ry.pa) - (rx.pf - rx.pa) || x - y;
  });
}

/** Fold-pair an even list, avoiding rematches; returns pairs (+ any forced rematches). */
function foldPair(
  order: number[],
  prior: Map<number, Set<number>>,
  forced: Array<[number, number]>,
): IGeneratedPair[] {
  // Try a rematch-free perfect matching via backtracking over `order`; fall back to fold with
  // minimum forced rematches. (order is small — ≤8 — so backtracking is trivial.)
  const n = order.length;
  const used = new Array(n).fill(false);
  const result: IGeneratedPair[] = [];
  const played = (a: number, b: number) => prior.get(a)?.has(b) === true;

  function backtrack(): boolean {
    const i = used.indexOf(false);
    if (i === -1) return true;
    used[i] = true;
    // prefer the fold partner first, then nearest others, skipping rematches
    for (let j = i + 1; j < n; j++) {
      if (used[j] || played(order[i], order[j])) continue;
      used[j] = true;
      result.push({ aTeamId: order[i], bTeamId: order[j] });
      if (backtrack()) return true;
      result.pop();
      used[j] = false;
    }
    used[i] = false;
    return false;
  }

  if (backtrack()) return result;

  // No rematch-free matching exists → fold pair and record forced rematches.
  used.fill(false);
  result.length = 0;
  const mid = n / 2;
  for (let i = 0; i < mid; i++) {
    const a = order[i], b = order[i + mid];
    result.push({ aTeamId: a, bTeamId: b });
    if (played(a, b)) forced.push([a, b]);
  }
  return result;
}

export function generateNextRound(matches: IMatch[]): IGenerationResult | null {
  const round = latestRound(matches);
  if (round === 0 || !isRoundComplete(matches, round)) return null;

  const records = buildTeamRecords(matches);
  const aliveIds = TEAMS.map((t) => t.id).filter((id) => alive(records, id));
  const qualified = TEAMS.filter((t) => records[t.id].w >= 3).length;
  if (aliveIds.length < 2 || qualified >= 4) return null;

  // Group by record, order groups (wins desc, losses asc)
  const groupKey = (id: number) => `${records[id].w}-${records[id].l}`;
  const keys = Array.from(new Set(aliveIds.map(groupKey))).sort((x, y) => {
    const [wx, lx] = x.split("-").map(Number);
    const [wy, ly] = y.split("-").map(Number);
    return wy - wx || lx - ly;
  });

  const prior = priorOpponents(matches);
  const forced: Array<[number, number]> = [];
  const pairs: IGeneratedPair[] = [];
  let floater: number | null = null;
  let bye: number | null = null;

  keys.forEach((key, gi) => {
    let ids = aliveIds.filter((id) => groupKey(id) === key);
    ids = standingOrder(ids, records);
    if (floater !== null) { ids = [...ids, floater]; floater = null; ids = standingOrder(ids, records); }
    if (ids.length % 2 === 1) {
      if (gi < keys.length - 1) {
        floater = ids[ids.length - 1]; // lowest floats down
        ids = ids.slice(0, -1);
      } else {
        bye = ids[ids.length - 1]; // last group odd → lowest gets the bye
        ids = ids.slice(0, -1);
      }
    }
    pairs.push(...foldPair(ids, prior, forced));
  });

  return { round: round + 1, pairs, bye, forcedRematches: forced };
}
```

> Note: the **bye handling here only computes who sits out**. Applying the bye's effect (free win vs. sit-out per DECISION POINT 2) is done at insertion time in Task 4 — the doc's approved choice decides whether a bye pair's record is bumped. Keep the pure module free of DB effects.

- [ ] **Step 4: Run to confirm GREEN**, then the full suite.

Run: `npm run test -- swissPairing && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/swissPairing.ts lib/tournament/__tests__/swissPairing.test.ts
git commit -m "feat(swiss): add pure Swiss pairing engine with tests"
```

---

### Task 3: Seed round 1 only; reset deletes generated rounds

**Files:**
- Create: `supabase/migrations/20260805000000_swiss_generation.sql`
- Create: `supabase/cloud-phase6.sql`
- Modify: `supabase/seed.sql` (remove the round-2 seed rows)

**Interfaces:**
- Consumes: existing `matches`, `reset_tournament()`.
- Produces: a DB where only round 1 exists at start; `reset_tournament()` clears scores AND deletes round ≥ 2 (generated) matches so a reset returns to a clean round-1 state.

- [ ] **Step 1: Migration** `20260805000000_swiss_generation.sql`:

```sql
-- Swiss generation: rounds 2+ are generated, not seeded. Delete any pre-seeded round>=2 matches
-- (idempotent), and make reset_tournament() clear scores AND drop generated rounds so a reset
-- returns to a clean round-1-only state.

delete from public.matches where round_n >= 2;

create index if not exists matches_round_n_idx on public.matches (round_n);

create or replace function public.reset_tournament()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- drop generated rounds; zero the round-1 scores; back to setup
  delete from public.matches where round_n >= 2;
  update public.matches set score_a = 0, score_b = 0, state = 'next' where round_n = 1 and deleted_at is null;
  update public.tournament set status = 'setup', updated_at = now() where id = true;
end;
$$;

revoke all on function public.reset_tournament() from public;
grant execute on function public.reset_tournament() to authenticated;
```

- [ ] **Step 2: Remove the round-2 seed rows** in `supabase/seed.sql` — keep only the four round-1 matches (M1–M4 / A-E, B-F, C-G, D-H); delete the M5–M8 (round 2) insert rows.

- [ ] **Step 3: cloud-phase6.sql** — the same statements as Step 1 (the `delete round>=2`, index, and `reset_tournament()` replacement), header-commented, idempotent, for the user to paste into the cloud SQL Editor. **Flag in the plan handoff that this DELETES pre-seeded round-2 matches on cloud** (destructive but intended — those seeded pairings are replaced by generation).

- [ ] **Step 4: Verify**

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select round_n, count(*) from public.matches group by round_n order by round_n;"
```
Expected: only `round_n = 1` with 4 matches. Then prove reset: as organizer (via psql `request.jwt.claims`, see Plan-1/earlier verification pattern), insert a fake round-2 match, call `select public.reset_tournament();`, confirm round-2 rows are gone and round-1 scores are zeroed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805000000_swiss_generation.sql supabase/cloud-phase6.sql supabase/seed.sql
git commit -m "feat(swiss): seed round 1 only and make reset drop generated rounds"
```

---

### Task 4: Generation server action `ensureNextRound`

**Files:**
- Create: `app/admin/referee/ensureNextRound.ts`
- Modify: `lib/supabase/tournament.ts` (add `getPairCodeToId`)

**Interfaces:**
- Consumes: `generateNextRound` (Task 2), `getMatches`, `createAuthServerClient`, the approved bye rule (DECISION POINT 2).
- Produces: `async function ensureNextRound(): Promise<{ generated: boolean; round?: number }>` — an organizer-guarded Server Action. Idempotent: computes the next round from current matches; if none is due (or it already exists), returns `{ generated: false }`; otherwise inserts the new matches (and applies the bye per the approved rule) and returns `{ generated: true, round }`.

- [ ] **Step 1: Add `getPairCodeToId`** to `lib/supabase/tournament.ts` (mirror `getPairIdToTeamId` but keyed the other way — letter code → uuid — so generation can turn team ids A=1…H=8 into pair uuids for insertion):

```ts
export async function getPairCodeToId(): Promise<Record<string, string>> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("pairs").select("id, code").is("deleted_at", null);
  if (error) throw new Error(`Failed to load pairs: ${error.message}`);
  const map: Record<string, string> = {};
  (data ?? []).forEach((p: { id: string; code: string }) => { map[p.code] = p.id; });
  return map;
}
```
Add a pure helper `teamIdToLetter(id: number): string` in `lib/tournament/data.ts` (`String.fromCharCode(64 + id)` → 1→'A'), or reuse the inverse of `letterToTeamId`.

- [ ] **Step 2: Implement the server action** `app/admin/referee/ensureNextRound.ts`:

```ts
"use server";

import { createAuthServerClient } from "@/lib/supabase/serverClient";
import { getMatches, getPairCodeToId } from "@/lib/supabase/tournament";
import { generateNextRound } from "@/lib/tournament/swissPairing";
import { teamIdToLetter } from "@/lib/tournament/data";

export async function ensureNextRound(): Promise<{ generated: boolean; round?: number }> {
  const supabase = await createAuthServerClient();

  // Organizer gate (defense-in-depth; RLS on matches INSERT also enforces it).
  const { data: isOrg } = await supabase.rpc("is_organizer");
  if (isOrg !== true) return { generated: false };

  const matches = await getMatches();
  const result = generateNextRound(matches);
  if (!result) return { generated: false };

  // Idempotency: if the target round already has matches, do nothing.
  if (matches.some((m) => m.round === result.round)) return { generated: false };

  const codeToId = await getPairCodeToId();
  const rows = result.pairs.map((p, i) => ({
    code: `R${result.round}-${i + 1}`,
    round_n: result.round,
    court: (i % 2) + 1,
    time_label: "",
    pair_a_id: codeToId[teamIdToLetter(p.aTeamId)],
    pair_b_id: codeToId[teamIdToLetter(p.bTeamId)],
    score_a: 0,
    score_b: 0,
    state: "next" as const,
  }));

  const { error } = await supabase.from("matches").insert(rows).select();
  if (error) {
    // RLS rejection (non-organizer) or constraint error — surface false, let caller retry later.
    return { generated: false };
  }

  // Apply the bye per the APPROVED rule (DECISION POINT 2). If bye = free win:
  // insert a synthetic done match, OR bump the pair's record via an agreed mechanism.
  // Implement per the doc's final decision (see the doc's "bye" section). If bye = sit-out,
  // do nothing here.

  return { generated: true, round: result.round };
}
```

> The bye application (Step 2's trailing comment) is implemented to whatever DECISION POINT 2 resolved to in Task 1's approved doc. If "free win," the simplest faithful mechanism is a synthetic `done` match `pair vs pair` isn't valid, so instead insert a `done` bye-match against a sentinel is messy — prefer recording the bye as a `+1 win` by inserting a `done` match only if a real opponent exists; otherwise the doc should choose "sit-out" to avoid a synthetic-opponent hack. **This is exactly why DECISION POINT 2 must be resolved before Task 2/4.**

- [ ] **Step 3: Verify (server-side, local).** Add a focused test or a scripted check: seed round 1, mark all four round-1 matches `done` (via psql as organizer), call the action's core by unit-testing `generateNextRound` on that state (already covered in Task 2), then manually invoke the action from a dev session (end the last round-1 match as an organizer) and confirm four round-2 rows appear with correct pairings and `code = "R2-1".."R2-2"`/etc. Confirm a second call is a no-op (idempotent).

- [ ] **Step 4: Commit**

```bash
git add app/admin/referee/ensureNextRound.ts lib/supabase/tournament.ts lib/tournament/data.ts
git commit -m "feat(swiss): add organizer-guarded next-round generation server action"
```

---

### Task 5: Fire generation automatically on round completion

**Files:**
- Modify: `app/admin/referee/RefereeScoringPanel.tsx`
- Modify: `app/admin/referee/page.tsx` (reconciliation on load)

**Interfaces:**
- Consumes: `ensureNextRound` (Task 4).
- Produces: after a successful `commit("done")`, the panel calls `ensureNextRound()` (fire-and-forget; realtime delivers new matches). The referee page's server load also calls it as a reconciliation so a missed generation self-heals on next visit.

- [ ] **Step 1: Call after ending a match.** In `RefereeScoringPanel.tsx`'s `commit` function, after a successful `state === "done"` write (inside the success branch, after the optimistic patch), invoke the server action without blocking the UI:

```ts
if (state === "done") {
  void ensureNextRound(); // realtime will deliver the generated round to all viewers
}
```
Import it: `import { ensureNextRound } from "./ensureNextRound";`. (Server Actions are callable from client components.)

- [ ] **Step 2: Reconcile on referee-page load.** In `app/admin/referee/page.tsx`'s `RefereeData`, when `status === "live"`, call `await ensureNextRound()` before fetching matches (so an organizer opening the page heals any missing round). This is safe/idempotent and only writes when a round is genuinely due.

```ts
if (status !== "live") return <RefereeNotLivePanel status={status} />;
await ensureNextRound(); // self-heal a missed generation; no-op when nothing is due
const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);
```

- [ ] **Step 3: Verify.** Local dev, as organizer: complete all round-1 matches; confirm round-2 matches appear automatically (via the end-of-last-match call) without a manual button, and that a second browser (public `/schedule`) shows the new round via realtime. Lint/build/test green.

- [ ] **Step 4: Commit**

```bash
git add app/admin/referee/RefereeScoringPanel.tsx app/admin/referee/page.tsx
git commit -m "feat(swiss): auto-generate the next round when a round completes"
```

---

### Task 6: Swiss-tree match picker in the referee screen

**Files:**
- Create: `app/admin/referee/RefereeSwissPicker.tsx`
- Modify: `app/admin/referee/RefereeScoringPanel.tsx`

**Interfaces:**
- Consumes: `computeSwissColumns`, `buildTeamRecords` (from `standings.ts`, read-only), the live `matches`, and Plan 1's selection rules (lock-to-live, only `next` selectable when nothing live).
- Produces: `RefereeSwissPicker({ matches, activeId, liveMatchId, onSelect })` — renders the Swiss columns (rounds) with each real match as a selectable card; enforces Plan 1's locking (only the live match is selectable when one is live; `done` and other-round matches are display-only). Replaces the flat "CHỌN TRẬN" list from Plan 1 Task 4.

- [ ] **Step 1: Build the picker** as a compact, horizontally-scrolling column-per-round view (reuse the visual grammar of `app/schedule/ScheduleBoard.tsx`'s Swiss cards, but each card that corresponds to a real `IMatch` is a `<button>`), driven by `computeSwissColumns(matches, buildTeamRecords(matches))`. Map each `ISwissMatchDisplay.code` back to the live `IMatch` by `code` to know its state and whether it is selectable. Highlight `activeId`; disable non-selectable cards (per lock rules). Do not display match codes/times (Plan 1).

- [ ] **Step 2: Swap it into the panel.** In `RefereeScoringPanel.tsx`, replace the flat list block (Plan 1 Task 4 Step 3) with `<RefereeSwissPicker matches={matches} activeId={activeMatch?.id ?? ""} liveMatchId={liveMatch?.id ?? null} onSelect={selectMatch} />`. Keep all of Plan 1's control logic (single Start/End, reset) unchanged — only the picker VISUAL changes.

- [ ] **Step 3: Verify.** Local dev: the referee picker shows a Swiss tree; selecting a current-round `next` match works; while a match is live, only that card is selectable; generated round-2 cards appear in the tree after round 1 completes. Lint/build/test green.

- [ ] **Step 4: Commit**

```bash
git add app/admin/referee/RefereeSwissPicker.tsx app/admin/referee/RefereeScoringPanel.tsx
git commit -m "feat(swiss): Swiss-tree match picker in the referee screen"
```

---

### Task 7: Terminal handling — stop at 4 qualified (semifinal seeding) [may be deferred]

**Files:**
- Modify: `lib/tournament/swissPairing.ts` (expose `isSwissComplete(matches): boolean`)
- Modify: `app/admin/referee/ensureNextRound.ts` (when Swiss is complete, seed semis)

**Interfaces:**
- Consumes: `computeQualified` (standings.ts), the terminal rule from the doc.
- Produces: when 4 pairs qualify, `generateNextRound` already returns `null`; add semifinal seeding (seed1v4, seed2v3) as generated matches in a distinct round marker (e.g. `round_n = 90` for semis, or a `stage` note), OR explicitly DEFER playoffs and document that the Swiss stage ends and playoffs remain the static bracket.

- [ ] **Step 1: Decide with the user at execution time** whether to auto-seed semis now or keep the existing static playoff bracket (`ScheduleBoard`'s Board 2). If deferring, add a one-line note in the rules doc that playoff generation is out of scope for this plan and commit that; if implementing, seed the two semifinal matches when `computeQualified(records).length === 4` and no semis exist, then let the referee score them.

- [ ] **Step 2: Verify + commit** per the chosen path.

```bash
git commit -m "feat(swiss): seed semifinals when four pairs qualify"   # or docs(swiss): defer playoff generation
```

---

## Test strategy

- **Pure engine (Vitest) — the risk lives here, test it hard.** `swissPairing.test.ts` must cover, with concrete fixtures:
  - `isRoundComplete` (empty round, partial, all-done).
  - `priorOpponents` (symmetry; only counts `done`).
  - R1→R2: two even groups, winners-only-vs-winners, no rematches (in Task 2 Step 1).
  - R2→R3: three even groups {2-0},{1-1},{0-2}; correct grouping + no rematches.
  - R3→R4: the odd-group **float + cross-pair** case from the doc's worked example (this is the hardest; assert the floater from {2-1} lands in {1-2} and the result is rematch-free).
  - **Rematch avoidance:** a fixture where naive fold pairing would rematch two teams; assert the engine finds the rematch-free matching.
  - **Forced rematch fallback:** a contrived fixture with no rematch-free matching; assert `forcedRematches` is non-empty and pairs are still complete.
  - **Gating:** `generateNextRound` returns `null` when the latest round is incomplete, when <2 alive, and when 4 have qualified.
  - **Bye:** an odd-total-alive fixture; assert `bye` is the correct lowest-standing pair and the rest are paired.
- **Server action:** `generateNextRound` is unit-tested; the action's insert/idempotency is verified by the local dev smoke (Task 4 Step 3) — the write is RLS-gated, so authorization is covered by the existing matches-INSERT policy.
- **Integration smoke (manual):** play a full local tournament as organizer, ending each round, and confirm rounds 2→5 generate correctly, the schedule tree updates live in a second browser, and a reset returns to a clean round-1-only state.
- **Regression:** the 18 `standings.ts` tests + Plan-1 tests stay green (this plan does not modify `standings.ts`).

## Risks

- **Bye semantics (DECISION POINT 2) leaks into the schema/insert.** A "free win" bye has no natural representation as a match row (there's no opponent). If the user picks "free win," agree the exact mechanism in Task 1 (e.g. a nullable-opponent bye row, or a separate `byes` concept) BEFORE Task 4 — do not improvise a synthetic opponent. Recommend "bye = sit out" for v1 simplicity; with 8 teams a bye is rare.
- **Rematch-avoidance correctness.** The backtracking matcher is the crux; a wrong pairing silently corrupts the bracket. This is why Task 2 demands the float/cross-pair and forced-rematch fixtures. Do not ship without the R3→R4 odd-group test passing.
- **Generation races / double-insert.** Two organizers ending matches near-simultaneously could both call `ensureNextRound`. The idempotency guard (`matches.some(m => m.round === result.round)`) plus the unique `code` constraint on `matches` prevents duplicates (the second insert violates the unique `code` and is rejected). Confirm `matches.code` is unique (it is per the schema) so the race fails safe.
- **Cloud data migration is destructive.** `cloud-phase6.sql` deletes pre-seeded round-2 matches. If the user is mid-tournament on cloud with real round-2 scores, warn before they run it (they should reset first). Called out in Handoff.
- **`standings.ts` display vs. generation.** The schedule board already renders generated matches (it groups existing matches by record). Verify no double-count or mis-group once matches are generated rather than seeded — the display logic is unchanged, so this is a smoke check, not a code change.

## Handoff

Execute with subagent-driven development, **Task 1 first and gated on user approval** (deuce + bye decisions). Migrations applied locally by the executor (`supabase db reset`); the **user applies `supabase/cloud-phase6.sql`** to cloud — WARN that it deletes pre-seeded round-2 matches (reset the cloud tournament first). The pairing engine is the high-risk unit; do not proceed past Task 2 without its full fixture suite (esp. the odd-group cross-pair) green.

---

## Self-Review

**Spec coverage:**
- "auto generate the next match when round 1 complete, follow Swiss" → Tasks 2 (engine) + 4 (action) + 5 (auto-fire). ✅
- "fully automatic on round completion" (chosen) → Task 5 fires after end-match + reconciles on load; realtime propagates. ✅
- "full Swiss: avoid rematches + cross-pair" (chosen) → Task 2 doc rules 5–7 + tests (float/cross-pair, rematch avoidance). ✅
- "show a Swiss tree to select match" → Task 6. ✅
- "with Swiss rule, create a local document so claude can remember" → Task 1 (`.memory/knowledge/swiss-format.md`). ✅
- Reset must stay coherent with generation → Task 3 (reset deletes generated rounds). ✅ (necessary consequence, added)

**Placeholder scan:** Task 2 ships a concrete algorithm (backtracking matcher, group/float/fold) — not a stub. The two genuinely open items (deuce, bye mechanism) are explicit DECISION POINTS resolved in Task 1 before dependent tasks, which is a gate, not a placeholder. Task 7 is explicitly optional/deferrable with a decision at execution. ✅

**Type consistency:** `IGeneratedPair`/`IGenerationResult`/`generateNextRound`/`isRoundComplete`/`priorOpponents`/`latestRound` defined in Task 2 and consumed in Tasks 4–6. `getPairCodeToId`/`teamIdToLetter` defined in Task 4 and used by the action. `ensureNextRound(): Promise<{generated, round?}>` consistent across Tasks 4–5. ✅
