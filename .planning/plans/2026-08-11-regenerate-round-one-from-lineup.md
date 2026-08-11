# Regenerate Round-1 Matches from Đội hình Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an organizer "sends đội hình" (clicks *Gửi đội hình & bắt đầu giải*), regenerate the round-1 match list from the current 8 pairs — paired adjacently (A–B, C–D, E–F, G–H) — and make `/teams` reflect roster edits immediately.

**Architecture:** Mirror the existing round-2+ Swiss generation pattern: a pure TS pairing function (vitest-tested) + a server action that deletes the stale round-1 seed and inserts fresh rows. A new setup-phase RLS `DELETE` policy on `matches` (mirroring the existing "organizers edit … in setup" policies) grants the delete. The regeneration runs inside the existing `start()` handler, immediately before `start_tournament()` flips the tournament to `live`. Separately, `/teams` switches from 1-hour ISR to `force-dynamic` so pair edits show right away.

**Tech Stack:** Next.js App Router (server actions), TypeScript, Supabase (Postgres + RLS), Vitest + Testing Library.

## Global Constraints

- `npm run build` MUST pass before any commit (project rule, CLAUDE.md).
- TDD: Red → Green → Refactor. Write the failing test first.
- Atomic commits, title only: `type(scope): what changed`. Scope = `mvp` (matches recent commit history on this branch).
- Commit under the user's configured git identity, never Claude's.
- Postgres uses `pg_safeupdate`: every `DELETE`/`UPDATE` MUST be qualified (have a `WHERE`). PostgREST `.delete()` calls must carry a filter.
- Adjacent pairing rule (organizer decision, 2026-08-11): 8 pairs sorted by code → M1: A–B, M2: C–D, M3: E–F, M4: G–H. Courts `1,2,1,2`; times `09:00, 09:00, 09:20, 09:20` (preserves the current seed layout in `supabase/seed.sql:50-54`).
- Regeneration is only reachable in `status='setup'` (the start button is disabled otherwise), so no live tournament data is destroyed beyond what `reset_tournament()` already wipes.

---

## File Structure

- **Create** `lib/tournament/roundOne.ts` — pure `generateRoundOne(pairCodes)` pairing function. One responsibility: the adjacent-pairing rule → match rows keyed by pair code.
- **Create** `lib/tournament/__tests__/roundOne.test.ts` — vitest for the pairing rule.
- **Create** `app/admin/regenerateRoundOne.ts` — `"use server"` action: load current pairs, build round-1 rows via `generateRoundOne`, delete existing matches, insert fresh. Mirrors `app/admin/referee/ensureNextRound.ts`.
- **Create** `supabase/migrations/20260811000000_round_one_delete_policy.sql` — setup-phase organizer `DELETE` policy + grant on `matches`.
- **Modify** `app/admin/LifecyclePanel.tsx:41-58` — call `regenerateRoundOne()` inside `start()` before `start_tournament()`.
- **Modify** `app/admin/__tests__/LifecyclePanel.test.tsx` — mock the server action; assert it runs before `start_tournament`.
- **Modify** `app/teams/page.tsx:10-12` — replace `export const revalidate = 3600` with `export const dynamic = "force-dynamic"`.

---

### Task 1: Pure round-1 pairing function

**Files:**
- Create: `lib/tournament/roundOne.ts`
- Test: `lib/tournament/__tests__/roundOne.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  ```ts
  export interface IRoundOneMatch {
    code: string;  // 'M1'..'M4'
    court: number; // 1 | 2
    time: string;  // '09:00' | '09:20'
    aCode: string; // pair code, side A (e.g. 'A')
    bCode: string; // pair code, side B (e.g. 'B')
  }
  export function generateRoundOne(pairCodes: string[]): IRoundOneMatch[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
// lib/tournament/__tests__/roundOne.test.ts
import { describe, expect, it } from "vitest";
import { generateRoundOne } from "@/lib/tournament/roundOne";

describe("generateRoundOne", () => {
  it("pairs 8 codes adjacently after sorting: A–B, C–D, E–F, G–H", () => {
    const rows = generateRoundOne(["H", "A", "C", "B", "E", "D", "G", "F"]);
    expect(rows).toEqual([
      { code: "M1", court: 1, time: "09:00", aCode: "A", bCode: "B" },
      { code: "M2", court: 2, time: "09:00", aCode: "C", bCode: "D" },
      { code: "M3", court: 1, time: "09:20", aCode: "E", bCode: "F" },
      { code: "M4", court: 2, time: "09:20", aCode: "G", bCode: "H" },
    ]);
  });

  it("throws when there are not exactly 8 pair codes", () => {
    expect(() => generateRoundOne(["A", "B", "C"])).toThrow(/exactly 8 pairs/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/tournament/__tests__/roundOne.test.ts`
Expected: FAIL — `generateRoundOne` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/tournament/roundOne.ts
export interface IRoundOneMatch {
  code: string;
  court: number;
  time: string;
  aCode: string;
  bCode: string;
}

/**
 * Round-1 pairing for the badminton championship: 8 pairs sorted by code, paired adjacently
 * (A–B, C–D, E–F, G–H). Courts alternate 1/2 and times step 09:00 → 09:20, preserving the
 * original seed layout (supabase/seed.sql). Used by the "send đội hình" flow to regenerate
 * round 1 from the current roster.
 */
export function generateRoundOne(pairCodes: string[]): IRoundOneMatch[] {
  if (pairCodes.length !== 8) {
    throw new Error("round one requires exactly 8 pairs");
  }
  const codes = [...pairCodes].sort((a, b) => a.localeCompare(b));
  return [0, 1, 2, 3].map((i) => ({
    code: `M${i + 1}`,
    court: (i % 2) + 1,
    time: i < 2 ? "09:00" : "09:20",
    aCode: codes[i * 2],
    bCode: codes[i * 2 + 1],
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/tournament/__tests__/roundOne.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/roundOne.ts lib/tournament/__tests__/roundOne.test.ts
git commit -m "feat(mvp): add pure round-1 adjacent pairing function"
```

---

### Task 2: Setup-phase DELETE policy on matches

**Files:**
- Create: `supabase/migrations/20260811000000_round_one_delete_policy.sql`

**Interfaces:**
- Consumes: existing `public.is_organizer()` and `public.is_setup_phase()` helpers.
- Produces: organizers may `DELETE` from `public.matches` while `status='setup'`. Enables Task 3's regeneration delete.

**Context:** `matches` currently has organizer `INSERT` (`supabase/migrations/20260803010000_organizer_gate.sql:40-43`) and setup-locked `UPDATE`/scoring policies, but **no `DELETE` policy and no `DELETE` grant** — so a client cannot delete match rows. Regeneration needs to remove the stale round-1 seed. This policy mirrors the existing "organizers edit players/pairs in setup" pattern (`supabase/migrations/20260804000000_admin_dashboard.sql:39-48`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260811000000_round_one_delete_policy.sql
-- Allow organizers to delete matches during setup so the "send đội hình" flow can regenerate
-- round 1 from the current pairs. Mirrors the "organizers edit ... in setup" policies. Scoring
-- (UPDATE) and INSERT policies are unchanged; DELETE stays denied once the tournament is live.

create policy "organizers delete matches in setup" on public.matches
  for delete using (public.is_organizer() and public.is_setup_phase());

grant delete on public.matches to authenticated;
```

- [ ] **Step 2: Apply against the local Supabase DB and verify it parses**

Run:
```bash
supabase db reset
```
Expected: all migrations apply with no error; the new policy is created. (If the org applies schema to the hosted project via the `supabase/cloud-phaseN.sql` convention, add an equivalent snippet there in the same commit — see Risks.)

- [ ] **Step 3: Verify the policy exists**

Run:
```bash
supabase db reset >/dev/null 2>&1 && \
psql "$(supabase status -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["DB_URL"])')" \
  -c "select polname from pg_policy where polrelid='public.matches'::regclass and polcmd='d';"
```
Expected: a row `organizers delete matches in setup`. (If `supabase status -o json` is unavailable in the environment, instead open Supabase Studio → Auth → Policies → `matches` and confirm the DELETE policy is listed.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811000000_round_one_delete_policy.sql
git commit -m "feat(mvp): allow organizers to delete matches during setup"
```

---

### Task 3: Server action to regenerate round 1 from current pairs

**Files:**
- Create: `app/admin/regenerateRoundOne.ts`

**Interfaces:**
- Consumes: `generateRoundOne` (Task 1); `createAuthServerClient` from `@/lib/supabase/serverClient`; `matches` DELETE policy (Task 2); existing `is_organizer` RPC.
- Produces:
  ```ts
  export async function regenerateRoundOne(): Promise<{ ok: boolean; error?: string }>;
  ```

**Context:** Mirrors `app/admin/referee/ensureNextRound.ts` (same auth client, same organizer gate, same insert shape). The `matches` INSERT policy already allows organizer inserts; Task 2 adds the setup-phase DELETE. This runs while `status='setup'`, before `start_tournament()` flips to `live`.

- [ ] **Step 1: Write the server action**

```ts
// app/admin/regenerateRoundOne.ts
"use server";

import { createAuthServerClient } from "@/lib/supabase/serverClient";
import { generateRoundOne } from "@/lib/tournament/roundOne";

/**
 * Organizer-guarded Server Action: rebuilds the round-1 match list from the current pairs
 * (đội hình), paired adjacently by code. Deletes every existing match row and inserts a fresh
 * round 1 with zeroed scores. Only usable in setup phase (enforced by RLS: the DELETE policy is
 * setup-gated). Invoked by the "Gửi đội hình & bắt đầu giải" flow before start_tournament().
 */
export async function regenerateRoundOne(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAuthServerClient();

  const { data: isOrg } = await supabase.rpc("is_organizer");
  if (isOrg !== true) return { ok: false, error: "not authorized" };

  const { data: pairs, error: pairsError } = await supabase
    .from("pairs")
    .select("id, code")
    .is("deleted_at", null);
  if (pairsError) return { ok: false, error: pairsError.message };
  if (!pairs || pairs.length !== 8) {
    return { ok: false, error: "roster incomplete: expected 8 pairs" };
  }

  const codeToId = new Map(pairs.map((p) => [p.code, p.id]));

  let rows;
  try {
    rows = generateRoundOne(pairs.map((p) => p.code)).map((mm) => ({
      code: mm.code,
      round_n: 1,
      court: mm.court,
      time_label: mm.time,
      pair_a_id: codeToId.get(mm.aCode)!,
      pair_b_id: codeToId.get(mm.bCode)!,
      score_a: 0,
      score_b: 0,
      state: "next" as const,
    }));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Qualified delete (pg_safeupdate + PostgREST both require a filter). All match rows have
  // round_n >= 1, so this clears the whole schedule before reseeding round 1.
  const { error: delError } = await supabase.from("matches").delete().gte("round_n", 1);
  if (delError) return { ok: false, error: delError.message };

  const { error: insError } = await supabase.from("matches").insert(rows);
  if (insError) return { ok: false, error: insError.message };

  return { ok: true };
}
```

- [ ] **Step 2: Verify the build/type-check passes**

Run: `npm run build`
Expected: build succeeds (no type errors on the new action).

- [ ] **Step 3: Commit**

```bash
git add app/admin/regenerateRoundOne.ts
git commit -m "feat(mvp): add regenerateRoundOne server action for đội hình flow"
```

---

### Task 4: Wire regeneration into the "send đội hình" flow

**Files:**
- Modify: `app/admin/LifecyclePanel.tsx:41-58` (the `start()` handler)
- Test: `app/admin/__tests__/LifecyclePanel.test.tsx`

**Interfaces:**
- Consumes: `regenerateRoundOne` (Task 3).
- Produces: clicking *Gửi đội hình & bắt đầu giải* regenerates round 1, then calls `start_tournament()`. On regeneration failure it shows the error and does NOT start.

- [ ] **Step 1: Write/adjust the failing test**

Add a mock for the server action at the top of `app/admin/__tests__/LifecyclePanel.test.tsx` (after the existing `next/navigation` mock):

```ts
vi.mock("@/app/admin/regenerateRoundOne", () => ({
  regenerateRoundOne: vi.fn().mockResolvedValue({ ok: true }),
}));
```

Import it and add a new assertion to the existing "calls the start_tournament RPC" test so both the action and the RPC are checked:

```ts
import { regenerateRoundOne } from "@/app/admin/regenerateRoundOne";
// ...inside the "calls the start_tournament RPC" test, after the click:
await waitFor(() => expect(rpc).toHaveBeenCalledWith("start_tournament"));
expect(vi.mocked(regenerateRoundOne)).toHaveBeenCalled();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- app/admin/__tests__/LifecyclePanel.test.tsx`
Expected: FAIL — `regenerateRoundOne` is never called (start() doesn't invoke it yet).

- [ ] **Step 3: Update `start()` in `LifecyclePanel.tsx`**

Add the import near the other imports:

```ts
import { regenerateRoundOne } from "@/app/admin/regenerateRoundOne";
```

Replace the body of `start()` (currently `app/admin/LifecyclePanel.tsx:41-58`) with:

```ts
  async function start() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      // 1) Rebuild round-1 matches from the current đội hình (only allowed in setup).
      const regen = await regenerateRoundOne();
      if (!regen.ok) {
        setMsg(`Không thể xếp lịch: ${regen.error}`);
        return;
      }
      // 2) Lock the roster and go live.
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("start_tournament");
      if (error) {
        setMsg(`Không thể bắt đầu: ${error.message}`);
        return;
      }
      setStatus("live");
      setMsg("Đã xếp lịch vòng 1, khoá đội hình và bắt đầu giải đấu.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- app/admin/__tests__/LifecyclePanel.test.tsx`
Expected: PASS (all four tests, including the new assertion).

- [ ] **Step 5: Run the full suite + build**

Run: `npm run test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/admin/LifecyclePanel.tsx app/admin/__tests__/LifecyclePanel.test.tsx
git commit -m "feat(mvp): regenerate round 1 from đội hình on start"
```

---

### Task 5: Make /teams reflect roster edits immediately

**Files:**
- Modify: `app/teams/page.tsx:10-12`

**Interfaces:**
- Consumes: nothing new.
- Produces: `/teams` reads fresh from Supabase per request (no 1-hour ISR cache), so pair/player edits appear right away — matching `/schedule` (`app/schedule/page.tsx:9`).

**Context:** `/teams` currently sets `export const revalidate = 3600`, caching the roster for an hour — the reason the user's pair edits didn't show. During setup the roster is actively edited, so it must be dynamic.

- [ ] **Step 1: Replace the caching directive**

In `app/teams/page.tsx`, replace lines 10-12:

```ts
// Cache teams data for 1 hour (ISR) — teams are effectively static and rarely change.
// This serves from cache on navigation, avoiding per-request Supabase round-trips.
export const revalidate = 3600;
```

with:

```ts
// Read fresh from Supabase on every request: the roster (đội hình) is edited in the admin during
// setup, so /teams must reflect pair/player changes immediately (mirrors /schedule).
export const dynamic = "force-dynamic";
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: build succeeds; `/teams` is no longer statically cached (build output shows it as dynamic `ƒ`, not static `○`).

- [ ] **Step 3: Commit**

```bash
git add app/teams/page.tsx
git commit -m "fix(mvp): make /teams dynamic so roster edits show immediately"
```

---

## Manual verification (after all tasks)

Do this against the running app (local `npm run dev` or the deployed preview), signed in as an organizer:

1. Reset the tournament (→ `setup`).
2. In `/admin/pairs`, change players/pairs so the đội hình differs from the seed.
3. Open `/teams` in another tab → the edited players/pairs appear immediately (no 1-hour wait).
4. Click **Gửi đội hình & bắt đầu giải**.
5. Open `/schedule` → round-1 matches now read **M1: A vs B, M2: C vs D, M3: E vs F, M4: G vs H** using the current pairs, all scores 0 / state "sắp diễn ra".
6. Confirm tournament status is now `live` and scoring works in `/admin/referee`.

---

## Risks

- **Hosted DB apply.** If the team applies schema to the hosted Supabase via the `supabase/cloud-phaseN.sql` files (there are `cloud-phase3..7` in the repo) rather than `supabase db push`, the new DELETE policy must ALSO be added there or regeneration will fail in production with an RLS error surfaced as "Không thể xếp lịch". Confirm the deploy path before shipping; add a `cloud-phase8-round-one-delete.sql` snippet if that's the convention.
- **Destructive-but-scoped.** Regeneration deletes ALL match rows. It's only reachable in `setup` (start button disabled otherwise), and `reset_tournament()` already zeroes scores, so no additional live data is at risk. Still, this is a hard delete — the manual verification step guards it.
- **Two-step atomicity.** `regenerateRoundOne()` and `start_tournament()` are separate calls. If regeneration succeeds but `start_tournament()` fails (e.g. roster invalid), matches are rebuilt but status stays `setup` — harmless and self-healing (clicking again rebuilds fresh). The start button is already disabled while `rosterError` is set, making this path unlikely.
- **Realtime churn.** Deleting + reinserting round 1 emits Supabase Realtime events on `matches`; `/schedule`'s `ScheduleBoard` island should absorb them, but sanity-check the board doesn't show a transient empty state during the swap.
- **`/teams` load.** Dropping ISR means each `/teams` view hits Supabase. Volume is tiny (a club tournament), so this is acceptable; revisit only if traffic ever warrants it.

---

## Self-Review

- **Spec coverage:** (a) regenerate round-1 matchups from đội hình → Tasks 1–4; (b) adjacent A–B/C–D/E–F/G–H rule → Task 1 + Global Constraints; (c) `/teams` should update → Task 5. All three requirements mapped.
- **Placeholder scan:** no TBD/"handle edge cases"/vague steps; every code step has real code.
- **Type consistency:** `IRoundOneMatch`/`generateRoundOne` defined in Task 1 and consumed with the same field names (`code`, `court`, `time`, `aCode`, `bCode`) in Task 3; `regenerateRoundOne(): Promise<{ ok, error? }>` defined in Task 3 and consumed with the same shape in Task 4. Insert row shape matches `matches` columns from `supabase/migrations/20260803000000_init_schema.sql:46-59`.
