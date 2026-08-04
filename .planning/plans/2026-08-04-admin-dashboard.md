# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Routing note (project convention, `~/.claude/CLAUDE.md`):** frontend execution is delegated to the `fe-plan-executor` agent; SQL migrations are hand-written here and applied locally by the executor and to cloud by the USER pasting `supabase/cloud-phase5.sql` (Claude cannot `supabase db push` to cloud).

**Goal:** Give allow-listed organizers a full admin area to edit players (name / tier / uploaded avatar), reassign the 8 pairs, run a `setup → live` tournament lifecycle (submit & start, reset scores), pick/start matches for scoring, and edit the public reward podium — all DB-enforced by RLS, not just hidden UI.

**Architecture:** One new gated route group `/admin` (server-gated by the existing `getOrganizerSession()`), a new singleton `tournament` table holding `status` + `rewards`, new organizer-only RLS write policies on `players`/`pairs`/`tournament`, and two `SECURITY DEFINER` RPCs (`start_tournament`, `reset_tournament`) for atomic multi-row transitions. Roster edits are DB-gated to the `setup` phase; scoring is DB-gated to the `live` phase. The existing pure Swiss logic in `lib/tournament/standings.ts` is **not touched** — pairs keep their fixed letter codes A–H, so numeric team ids stay stable.

**Tech Stack:** Next.js 16.2 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Supabase (Postgres + Auth + RLS + Realtime + **Storage**), Vitest + Testing Library.

## Global Constraints

- **Do NOT modify `lib/tournament/standings.ts`** — 18 passing tests depend on it; pair letter codes A–H stay fixed so numeric team ids (`letterToTeamId`) never shift.
- **Roster is fixed: 16 players / 8 pairs (A–H).** No add/remove of players or pairs — edit-in-place only.
- **Avatars are uploaded files** → Supabase Storage bucket `avatars` (public read, organizer-only write). Preset avatars already in `public/avatars/*.jpg` must keep working (non-breaking).
- **Lifecycle = `setup → live → done`.** `submit & start` flips `setup→live` and locks the roster. `reset` = **scores/state only** (all matches back to `score 0 / state 'next'`, tournament back to `setup`); it keeps players & pairs. `done` is reserved in the CHECK constraint but only `setup↔live` are wired in v1.
- **Authorization is enforced in Postgres (RLS + `is_organizer()`), never by hiding UI.** Every new write path gets an explicit policy.
- **`npm run build` + `npm run lint` + `npm run test` must all pass before every commit.** Atomic commits, title only, under the user's git identity: `type(scope): what changed` (scope = `admin`).
- **Never commit secrets.** Only `.env.local` (gitignored) holds the URL + publishable key.
- App copy is Vietnamese. Match the existing inline-style visual language (colors `#0A1F1A`, `#0B5D4E`, `#F2B544`, `#FFFDF7`; fonts `var(--font-archivo)`, `var(--font-bricolage)`, `var(--font-jetbrains)`).

---

## File Structure

**Database / SQL**
- Create `supabase/migrations/20260804000000_admin_dashboard.sql` — `tournament` table, `avatar_url` column, `is_setup_phase()`, RLS write policies, `start_tournament()`/`reset_tournament()` RPCs, `avatars` storage bucket + policies.
- Create `supabase/cloud-phase5.sql` — same statements, consolidated + idempotent, for the USER to paste into the cloud SQL Editor.
- Modify `supabase/seed.sql` — insert the singleton `tournament` row (status `'live'`) + seed `rewards`.

**Data layer / types**
- Modify `lib/supabase/database.types.ts` — add `tournament` table, `players.avatar_url`, and the 3 new functions.
- Modify `lib/tournament/data.ts` — add `avatarUrl?` to `IPlayer`; `avatarPhotoPath()` prefers it.
- Create `lib/tournament/reward.ts` — `IReward`, `DEFAULT_REWARDS`, `mergeRewards()`, `parseRewards()`.
- Modify `lib/supabase/tournament.ts` — `toPlayer` maps `avatar_url`; add `getTournament()`.
- Create `lib/supabase/admin.ts` — server reads that carry row **ids** for editing: `getAdminPlayers()`, `getAdminPairs()`.
- Create `lib/tournament/adminValidation.ts` — pure guards: `validatePlayerName`, `validateTier`, `validatePairAssignment`, `validateRosterComplete`.

**Routes / UI (`/admin`)**
- Create `app/admin/layout.tsx` — server gate + admin shell/sub-nav.
- Create `app/admin/AdminDenied.tsx`, `app/admin/AdminSignedOut.tsx` — reuse look of referee panels.
- Create `app/admin/page.tsx` + `app/admin/LifecyclePanel.tsx` (client) — status badge, Submit & Start, Reset (confirm).
- Create `app/admin/players/page.tsx` + `app/admin/players/PlayersEditor.tsx` (client).
- Create `app/admin/pairs/page.tsx` + `app/admin/pairs/PairsEditor.tsx` (client).
- Create `app/admin/rewards/page.tsx` + `app/admin/rewards/RewardsEditor.tsx` (client).
- Create `components/AvatarUpload.tsx` (client) — file → Storage → `avatar_url`.
- Modify `components/SiteHeader.tsx` — organizer-only "Quản trị" nav link.
- Modify `app/page.tsx` — rewards podium reads `getTournament().rewards`.
- Modify `app/referee/RefereeScoringPanel.tsx` — explicit "Bắt đầu trận" (state→`live`, score unchanged).

**Tests**
- Create `lib/tournament/__tests__/reward.test.ts`, `lib/tournament/__tests__/adminValidation.test.ts`.

---

## Phase overview

- **Phase A — DB foundation** (Tasks 1–4): schema, RPCs, storage, types, seed.
- **Phase B — Data layer** (Tasks 5–8): reward module, validation module, admin reads, `getTournament`.
- **Phase C — Admin shell + lifecycle** (Tasks 9–11): gated `/admin`, Submit & Start, Reset.
- **Phase D — Editors** (Tasks 12–15): players (+ avatar upload), pairs, rewards.
- **Phase E — Public + scoring wiring** (Tasks 16–18): rewards on home, header link, start-match control.
- **Phase F — Verify & document** (Task 19): full RLS/RPC proof, cloud SQL, docs.

Each task ends with lint/build/tests green and one atomic commit.

---

### Task 1: `tournament` table + `avatar_url` column + lifecycle helper (migration)

**Files:**
- Create: `supabase/migrations/20260804000000_admin_dashboard.sql`

**Interfaces:**
- Produces: table `public.tournament(id boolean pk, status text, rewards jsonb, updated_at timestamptz)`; column `public.players.avatar_url text null`; function `public.is_setup_phase() returns boolean`.

- [ ] **Step 1: Write the migration (schema portion)**

```sql
-- Phase 5 (admin dashboard): tournament lifecycle singleton, uploaded-avatar column,
-- setup-phase helper. Follows the same FK-friendly Supabase conventions as earlier migrations.

-- players: uploaded-avatar URL (preset avatar_key stays for the seeded photos) -----------
alter table public.players add column if not exists avatar_url text null;

-- tournament singleton ------------------------------------------------------------------
-- `id boolean primary key default true check (id)` guarantees at most one row.
create table if not exists public.tournament (
  id boolean primary key default true check (id),
  status text not null default 'setup' check (status in ('setup', 'live', 'done')),
  rewards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed status='live' to preserve the currently-deployed running tournament. Admins reach
-- 'setup' via reset_tournament(). Idempotent.
insert into public.tournament (id, status) values (true, 'live')
  on conflict (id) do nothing;

alter table public.tournament enable row level security;

-- is_setup_phase(): true only while the tournament is in 'setup'. SECURITY DEFINER + pinned
-- search_path, same hardening as is_organizer().
create or replace function public.is_setup_phase()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.tournament t where t.id = true and t.status = 'setup');
$$;

revoke all on function public.is_setup_phase() from public;
grant execute on function public.is_setup_phase() to anon, authenticated;
```

- [ ] **Step 2: Apply locally and verify the table + helper exist**

Run:
```bash
supabase db reset   # re-applies all migrations + seed to local
```
Expected: no error; `select public.is_setup_phase();` returns `f` (seeded status is `live`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260804000000_admin_dashboard.sql
git commit -m "feat(admin): add tournament lifecycle table and setup-phase helper"
```

---

### Task 2: RLS write policies + start/reset RPCs (same migration)

**Files:**
- Modify: `supabase/migrations/20260804000000_admin_dashboard.sql`

**Interfaces:**
- Consumes: `public.is_organizer()` (existing), `public.is_setup_phase()` (Task 1).
- Produces: RPCs `public.start_tournament()` and `public.reset_tournament()` (both `returns void`); organizer write policies on `players`, `pairs`, `tournament`; scoring gate tightened on `matches`.

- [ ] **Step 1: Append RLS write policies**

```sql
-- players / pairs: organizers may edit ONLY during setup (locks roster once live) -----------
create policy "organizers edit players in setup" on public.players
  for update using (public.is_organizer() and public.is_setup_phase())
  with check (public.is_organizer() and public.is_setup_phase());

create policy "organizers edit pairs in setup" on public.pairs
  for update using (public.is_organizer() and public.is_setup_phase())
  with check (public.is_organizer() and public.is_setup_phase());

grant update on public.players to authenticated;
grant update on public.pairs to authenticated;

-- tournament: public reads (status + rewards are public); organizers edit (rewards; status
-- transitions go through the RPCs below but a direct organizer UPDATE is also allowed) -------
create policy "tournament is publicly readable" on public.tournament
  for select using (true);

create policy "organizers edit tournament" on public.tournament
  for update using (public.is_organizer())
  with check (public.is_organizer());

grant select on public.tournament to anon, authenticated;
grant update on public.tournament to authenticated;

-- matches: tighten the existing organizer UPDATE so scoring is only possible while 'live'.
-- (The Phase 3 policy "organizers can update matches" allowed writes in any phase.)
drop policy if exists "organizers can update matches" on public.matches;
create policy "organizers score matches when live" on public.matches
  for update using (
    public.is_organizer()
    and exists (select 1 from public.tournament t where t.id = true and t.status = 'live')
  )
  with check (
    public.is_organizer()
    and exists (select 1 from public.tournament t where t.id = true and t.status = 'live')
  );
```

- [ ] **Step 2: Append the two RPCs**

```sql
-- start_tournament(): setup -> live. Validates the roster is complete before locking. -------
create or replace function public.start_tournament()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if (select count(*) from public.pairs where deleted_at is null) <> 8 then
    raise exception 'roster incomplete: expected 8 pairs';
  end if;
  if exists (
    select 1 from public.pairs
    where deleted_at is null and (player1_id is null or player2_id is null or player1_id = player2_id)
  ) then
    raise exception 'roster invalid: each pair needs two distinct players';
  end if;
  update public.tournament set status = 'live', updated_at = now() where id = true;
end;
$$;

-- reset_tournament(): zero all scores/state and return to setup. Keeps players + pairs. -----
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
  update public.matches
    set score_a = 0, score_b = 0, state = 'next'
    where deleted_at is null;
  update public.tournament set status = 'setup', updated_at = now() where id = true;
end;
$$;

revoke all on function public.start_tournament() from public;
revoke all on function public.reset_tournament() from public;
grant execute on function public.start_tournament() to authenticated;
grant execute on function public.reset_tournament() to authenticated;
```

- [ ] **Step 2b: Add the `avatars` Storage bucket + policies**

```sql
-- avatars bucket: public read, organizer-only write (uploads from the admin players editor) --
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "organizers upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars' and public.is_organizer());

create policy "organizers overwrite avatars" on storage.objects
  for update using (bucket_id = 'avatars' and public.is_organizer())
  with check (bucket_id = 'avatars' and public.is_organizer());
```

- [ ] **Step 3: Apply locally and prove the RPCs + gate**

Run:
```bash
supabase db reset
```
Then in `supabase db` psql (or Studio SQL), as an anon/non-organizer role confirm:
- `select public.reset_tournament();` → `not authorized`
- After a manual local `update tournament set status='setup'`, an anon `update players set name='x'` → 0 rows (RLS blocks non-organizer).

Expected: authorization errors / 0 rows for non-organizers; success only for organizer JWT (verified end-to-end in Task 19).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260804000000_admin_dashboard.sql
git commit -m "feat(admin): add roster/tournament RLS policies, start/reset RPCs, avatars bucket"
```

---

### Task 3: Consolidated cloud SQL for the user to paste

**Files:**
- Create: `supabase/cloud-phase5.sql`

**Interfaces:**
- Produces: one idempotent script mirroring Tasks 1–2 for the cloud project (the user runs it; Claude cannot push to cloud).

- [ ] **Step 1: Write `cloud-phase5.sql`** — copy every statement from `20260804000000_admin_dashboard.sql` verbatim (all statements are already `if not exists` / `on conflict` / `create or replace` / `drop policy if exists`, so the whole file is safely re-runnable). Add a header comment:

```sql
-- ============================================================
-- Badminton Championship — cloud Phase 5 (Admin dashboard)
-- Run ONCE in the cloud SQL Editor, after cloud-init/phase3/phase4.
-- Safe to re-run (idempotent).
-- ============================================================
```

- [ ] **Step 2: Verify it parses locally against a fresh DB**

Run:
```bash
supabase db reset && psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/cloud-phase5.sql
```
Expected: runs clean a second time with no errors (idempotency proof).

- [ ] **Step 3: Commit**

```bash
git add supabase/cloud-phase5.sql
git commit -m "chore(admin): add consolidated cloud phase 5 SQL"
```

---

### Task 4: Regenerate DB types + seed the tournament row

**Files:**
- Modify: `lib/supabase/database.types.ts`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces: `Database["public"]["Tables"]["tournament"]`, `players.Row.avatar_url: string | null`, and `Functions` entries `is_setup_phase`, `start_tournament`, `reset_tournament`.

- [ ] **Step 1: Add `avatar_url` to the `players` Row/Insert/Update** in `lib/supabase/database.types.ts` (three occurrences), e.g. in `Row`:

```ts
        Row: {
          avatar_key: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          tier: number
        }
```
(and `avatar_url?: string | null` in `Insert` and `Update`).

- [ ] **Step 2: Add the `tournament` table block** inside `public.Tables` (alongside `matches`, `pairs`, …):

```ts
      tournament: {
        Row: { id: boolean; status: string; rewards: Json; updated_at: string }
        Insert: { id?: boolean; status?: string; rewards?: Json; updated_at?: string }
        Update: { id?: boolean; status?: string; rewards?: Json; updated_at?: string }
        Relationships: []
      }
```

- [ ] **Step 3: Add the new functions** to `public.Functions`:

```ts
    Functions: {
      is_organizer: { Args: never; Returns: boolean }
      is_setup_phase: { Args: never; Returns: boolean }
      start_tournament: { Args: never; Returns: undefined }
      reset_tournament: { Args: never; Returns: undefined }
    }
```

- [ ] **Step 4: Seed the singleton in `supabase/seed.sql`** (append):

```sql
-- Tournament singleton: live status + reward podium (mirrors the design's Phần thưởng section).
insert into public.tournament (id, status, rewards) values (
  true,
  'live',
  '[
    {"place":1,"medal":"🏆","title":"Cúp vô địch + phần thưởng chính","detail":"Sẽ công bố 🎉"},
    {"place":2,"medal":"🥈","title":"Huy chương bạc + phần thưởng","detail":"Sẽ công bố 🎉"},
    {"place":3,"medal":"🥉","title":"Huy chương đồng + phần thưởng","detail":"Sẽ công bố 🎉"}
  ]'::jsonb
) on conflict (id) do nothing;
```

- [ ] **Step 5: Verify build compiles with new types**

Run: `npm run build`
Expected: PASS (types resolve; nothing consumes them yet).

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/database.types.ts supabase/seed.sql
git commit -m "feat(admin): add tournament + avatar_url db types and seed"
```

---

### Task 5: Reward module (pure logic, TDD)

**Files:**
- Create: `lib/tournament/reward.ts`
- Test: `lib/tournament/__tests__/reward.test.ts`

**Interfaces:**
- Produces:
  - `interface IReward { place: number; medal: string; title: string; detail: string }`
  - `const DEFAULT_REWARDS: IReward[]` (3 entries, ported from the seed above)
  - `function parseRewards(raw: unknown): IReward[]` — validates/normalizes a jsonb value, falling back to `DEFAULT_REWARDS` on any malformed input.
  - `function mergeRewards(edits: Partial<IReward>[]): IReward[]` — merges editor edits over defaults by `place`, always returns exactly 3 sorted entries.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_REWARDS, mergeRewards, parseRewards } from "@/lib/tournament/reward";

describe("parseRewards", () => {
  it("falls back to defaults on non-array input", () => {
    expect(parseRewards(null)).toEqual(DEFAULT_REWARDS);
    expect(parseRewards("nope")).toEqual(DEFAULT_REWARDS);
  });

  it("normalizes a valid array and sorts by place", () => {
    const raw = [
      { place: 2, medal: "🥈", title: "Nhì", detail: "x" },
      { place: 1, medal: "🏆", title: "Nhất", detail: "y" },
      { place: 3, medal: "🥉", title: "Ba", detail: "z" },
    ];
    expect(parseRewards(raw).map((r) => r.place)).toEqual([1, 2, 3]);
    expect(parseRewards(raw)[0].title).toBe("Nhất");
  });

  it("drops malformed entries and backfills from defaults", () => {
    const raw = [{ place: 1, title: "Chỉ tiêu đề" }];
    const out = parseRewards(raw);
    expect(out).toHaveLength(3);
    expect(out[0].title).toBe("Chỉ tiêu đề");
    expect(out[0].medal).toBe(DEFAULT_REWARDS[0].medal); // backfilled
  });
});

describe("mergeRewards", () => {
  it("always returns 3 sorted entries", () => {
    const out = mergeRewards([{ place: 1, title: "New champ" }]);
    expect(out).toHaveLength(3);
    expect(out[0].title).toBe("New champ");
    expect(out[1]).toEqual(DEFAULT_REWARDS[1]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- reward`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/tournament/reward.ts`**

```ts
export interface IReward {
  place: number;
  medal: string;
  title: string;
  detail: string;
}

export const DEFAULT_REWARDS: IReward[] = [
  { place: 1, medal: "🏆", title: "Cúp vô địch + phần thưởng chính", detail: "Sẽ công bố 🎉" },
  { place: 2, medal: "🥈", title: "Huy chương bạc + phần thưởng", detail: "Sẽ công bố 🎉" },
  { place: 3, medal: "🥉", title: "Huy chương đồng + phần thưởng", detail: "Sẽ công bố 🎉" },
];

function defaultFor(place: number): IReward {
  return DEFAULT_REWARDS.find((r) => r.place === place) ?? DEFAULT_REWARDS[0];
}

function normalizeOne(input: Partial<IReward> | undefined, place: number): IReward {
  const base = defaultFor(place);
  const src = input ?? {};
  return {
    place,
    medal: typeof src.medal === "string" && src.medal ? src.medal : base.medal,
    title: typeof src.title === "string" && src.title ? src.title : base.title,
    detail: typeof src.detail === "string" && src.detail ? src.detail : base.detail,
  };
}

export function parseRewards(raw: unknown): IReward[] {
  if (!Array.isArray(raw)) return DEFAULT_REWARDS;
  const byPlace = new Map<number, Partial<IReward>>();
  for (const item of raw) {
    if (item && typeof item === "object" && typeof (item as { place?: unknown }).place === "number") {
      byPlace.set((item as { place: number }).place, item as Partial<IReward>);
    }
  }
  return [1, 2, 3].map((place) => normalizeOne(byPlace.get(place), place));
}

export function mergeRewards(edits: Partial<IReward>[]): IReward[] {
  const byPlace = new Map<number, Partial<IReward>>();
  for (const e of edits) {
    if (typeof e.place === "number") byPlace.set(e.place, e);
  }
  return [1, 2, 3].map((place) => normalizeOne(byPlace.get(place), place));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- reward`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/reward.ts lib/tournament/__tests__/reward.test.ts
git commit -m "feat(admin): add reward parse/merge module with tests"
```

---

### Task 6: Admin validation module (pure logic, TDD)

**Files:**
- Create: `lib/tournament/adminValidation.ts`
- Test: `lib/tournament/__tests__/adminValidation.test.ts`

**Interfaces:**
- Produces:
  - `function validatePlayerName(name: string): string | null` — returns an error message or `null` if valid (non-empty, ≤ 40 chars after trim).
  - `function validateTier(tier: number): tier is TTier` — true for 1–4.
  - `function validatePairAssignment(player1Id: string, player2Id: string): string | null` — error if empty or identical.
  - `function validateRosterComplete(pairs: { player1Id: string; player2Id: string }[], playerCount: number): string | null` — error unless 8 pairs, all distinct-within-pair, exactly 16 players.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  validatePairAssignment,
  validatePlayerName,
  validateRosterComplete,
  validateTier,
} from "@/lib/tournament/adminValidation";

describe("validatePlayerName", () => {
  it("rejects empty and over-long, accepts normal", () => {
    expect(validatePlayerName("  ")).toMatch(/tên/i);
    expect(validatePlayerName("x".repeat(41))).toMatch(/dài/i);
    expect(validatePlayerName("Trúc")).toBeNull();
  });
});

describe("validateTier", () => {
  it("accepts 1-4 only", () => {
    expect(validateTier(1)).toBe(true);
    expect(validateTier(4)).toBe(true);
    expect(validateTier(0)).toBe(false);
    expect(validateTier(5)).toBe(false);
  });
});

describe("validatePairAssignment", () => {
  it("rejects empty or identical players", () => {
    expect(validatePairAssignment("", "b")).toMatch(/chọn/i);
    expect(validatePairAssignment("a", "a")).toMatch(/khác nhau/i);
    expect(validatePairAssignment("a", "b")).toBeNull();
  });
});

describe("validateRosterComplete", () => {
  const eightPairs = Array.from({ length: 8 }, (_, i) => ({ player1Id: `p${2 * i}`, player2Id: `p${2 * i + 1}` }));
  it("passes for 8 valid pairs + 16 players", () => {
    expect(validateRosterComplete(eightPairs, 16)).toBeNull();
  });
  it("fails when a pair is incomplete", () => {
    const bad = [...eightPairs.slice(1), { player1Id: "p0", player2Id: "" }];
    expect(validateRosterComplete(bad, 16)).toMatch(/cặp/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- adminValidation`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/tournament/adminValidation.ts`**

```ts
import type { TTier } from "@/lib/tournament/data";

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Tên không được để trống.";
  if (trimmed.length > 40) return "Tên quá dài (tối đa 40 ký tự).";
  return null;
}

export function validateTier(tier: number): tier is TTier {
  return tier === 1 || tier === 2 || tier === 3 || tier === 4;
}

export function validatePairAssignment(player1Id: string, player2Id: string): string | null {
  if (!player1Id || !player2Id) return "Hãy chọn đủ 2 người cho mỗi cặp.";
  if (player1Id === player2Id) return "Hai người trong một cặp phải khác nhau.";
  return null;
}

export function validateRosterComplete(
  pairs: { player1Id: string; player2Id: string }[],
  playerCount: number,
): string | null {
  if (pairs.length !== 8) return "Cần đúng 8 cặp đấu.";
  for (const p of pairs) {
    const err = validatePairAssignment(p.player1Id, p.player2Id);
    if (err) return err;
  }
  if (playerCount !== 16) return "Cần đúng 16 vận động viên.";
  return null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- adminValidation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/adminValidation.ts lib/tournament/__tests__/adminValidation.test.ts
git commit -m "feat(admin): add roster/player validation module with tests"
```

---

### Task 7: `avatarUrl` on IPlayer + resolver + mapper

**Files:**
- Modify: `lib/tournament/data.ts`
- Modify: `lib/supabase/tournament.ts`

**Interfaces:**
- Consumes: `players.avatar_url` (Task 4).
- Produces: `IPlayer.avatarUrl?: string`; `avatarPhotoPath()` prefers `avatarUrl` over the preset `/avatars/{key}.jpg`.

- [ ] **Step 1: Add `avatarUrl` to `IPlayer`** in `lib/tournament/data.ts`:

```ts
export interface IPlayer {
  name: string;
  tier: TTier;
  avatarKey?: string;
  /** Full public URL of an uploaded avatar (Supabase Storage). Takes precedence over avatarKey. */
  avatarUrl?: string;
}
```

- [ ] **Step 2: Update `avatarPhotoPath` to prefer the uploaded URL**:

```ts
export function avatarPhotoPath(player: IPlayer): string | undefined {
  if (player.avatarUrl) return player.avatarUrl;
  return player.avatarKey ? `/avatars/${player.avatarKey}.jpg` : undefined;
}
```

- [ ] **Step 3: Map `avatar_url` in `toPlayer`** (`lib/supabase/tournament.ts`) — extend the `Pick` and mapper:

```ts
type TPlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "name" | "tier" | "avatar_key" | "avatar_url"
>;

function toPlayer(row: TPlayerRow): IPlayer {
  return {
    name: row.name,
    tier: row.tier as TTier,
    avatarKey: row.avatar_key ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
  };
}
```
Also add `avatar_url` to the `.select("id, name, tier, avatar_key")` call in `getTeams()` → `.select("id, name, tier, avatar_key, avatar_url")`.

- [ ] **Step 4: Verify build + existing tests unaffected**

Run: `npm run build && npm run test`
Expected: PASS (36 tests: 18 standings + reward + adminValidation; `PlayerAvatar` already reads `avatarPhotoPath`, so uploaded photos flow through with no component change).

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/data.ts lib/supabase/tournament.ts
git commit -m "feat(admin): resolve uploaded avatar_url with preset fallback"
```

---

### Task 8: Server reads — `getTournament`, `getAdminPlayers`, `getAdminPairs`

**Files:**
- Modify: `lib/supabase/tournament.ts`
- Create: `lib/supabase/admin.ts`

**Interfaces:**
- Produces:
  - `getTournament(): Promise<{ status: "setup" | "live" | "done"; rewards: IReward[] }>` (in `tournament.ts`, uses the anon server client — status/rewards are public).
  - `getAdminPlayers(): Promise<IAdminPlayer[]>` where `IAdminPlayer = { id: string; name: string; tier: TTier; avatarKey: string | null; avatarUrl: string | null }`.
  - `getAdminPairs(): Promise<IAdminPair[]>` where `IAdminPair = { id: string; code: string; name: string; player1Id: string; player2Id: string }`.
  - Admin reads use the **auth** server client (`createAuthServerClient`) so they run under the organizer session.

- [ ] **Step 1: Add `getTournament` to `lib/supabase/tournament.ts`**

```ts
import { parseRewards, type IReward } from "@/lib/tournament/data-reward"; // see note
```
(Use the real path `@/lib/tournament/reward`.) Then:

```ts
export async function getTournament(): Promise<{ status: "setup" | "live" | "done"; rewards: IReward[] }> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tournament")
    .select("status, rewards")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load tournament: ${error.message}`);
  }
  const status = (data?.status ?? "setup") as "setup" | "live" | "done";
  return { status, rewards: parseRewards(data?.rewards) };
}
```

- [ ] **Step 2: Create `lib/supabase/admin.ts`**

```ts
import "server-only";
import { createAuthServerClient } from "./serverClient";
import type { TTier } from "@/lib/tournament/data";

export interface IAdminPlayer {
  id: string;
  name: string;
  tier: TTier;
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

export async function getAdminPlayers(): Promise<IAdminPlayer[]> {
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, name, tier, avatar_key, avatar_url")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load players: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier as TTier,
    avatarKey: p.avatar_key,
    avatarUrl: p.avatar_url,
  }));
}

export async function getAdminPairs(): Promise<IAdminPair[]> {
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase
    .from("pairs")
    .select("id, code, name, player1_id, player2_id")
    .is("deleted_at", null)
    .order("code", { ascending: true });
  if (error) throw new Error(`Failed to load pairs: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    player1Id: p.player1_id,
    player2Id: p.player2_id,
  }));
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/tournament.ts lib/supabase/admin.ts
git commit -m "feat(admin): add tournament + admin player/pair server reads"
```

---

### Task 9: Gated `/admin` shell + sub-nav

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/AdminSignedOut.tsx`
- Create: `app/admin/AdminDenied.tsx`
- Create: `app/admin/AdminNav.tsx`

**Interfaces:**
- Consumes: `getOrganizerSession()` (existing, `lib/auth/organizer.ts`).
- Produces: server layout that renders children only for organizers; `AdminNav` client component linking the 4 sub-pages.

- [ ] **Step 1: Create `app/admin/AdminSignedOut.tsx` and `app/admin/AdminDenied.tsx`** — copy the structure/styling of `app/referee/RefereeSignedOutPanel.tsx` and `RefereeDeniedPanel.tsx` (read them first), changing copy to "Khu vực quản trị". `AdminSignedOut` calls `signInWithGoogle("/admin")`. (Repeat the panel markup — do not import the referee ones, keep the admin area self-contained.)

- [ ] **Step 2: Create `app/admin/AdminNav.tsx`** (client):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/players", label: "Vận động viên" },
  { href: "/admin/pairs", label: "Cặp đấu" },
  { href: "/admin/rewards", label: "Phần thưởng" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 24 }}>
      {ADMIN_NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              color: active ? "#FFFDF7" : "#3C5A53",
              background: active ? "#0B5D4E" : "rgba(11,93,78,.07)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Create `app/admin/layout.tsx`** (server-gated):

```tsx
import { getOrganizerSession } from "@/lib/auth/organizer";
import { AdminSignedOut } from "./AdminSignedOut";
import { AdminDenied } from "./AdminDenied";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isOrganizer } = await getOrganizerSession();

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 20px 60px" }}>
      {!user && <AdminSignedOut />}
      {user && !isOrganizer && <AdminDenied email={user.email} />}
      {user && isOrganizer && (
        <>
          <AdminNav />
          {children}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add a temporary `app/admin/page.tsx` stub** so the route resolves:

```tsx
export default function AdminOverviewPage() {
  return <div>Tổng quan quản trị</div>;
}
```

- [ ] **Step 5: Verify build + manual gate**

Run: `npm run build`
Then `npm run dev`, visit `/admin` signed-out → sign-in panel; the real organizer check is proven in Task 19.
Expected: build PASS; signed-out visitor sees the sign-in panel, never the children.

- [ ] **Step 6: Commit**

```bash
git add app/admin/layout.tsx app/admin/AdminSignedOut.tsx app/admin/AdminDenied.tsx app/admin/AdminNav.tsx app/admin/page.tsx
git commit -m "feat(admin): add gated /admin shell and sub-navigation"
```

---

### Task 10: Lifecycle panel — Submit & Start

**Files:**
- Modify: `app/admin/page.tsx`
- Create: `app/admin/LifecyclePanel.tsx`

**Interfaces:**
- Consumes: `getTournament()` (Task 8), `start_tournament` RPC (Task 2).
- Produces: `LifecyclePanel` (client) taking `initialStatus` and calling `supabase.rpc("start_tournament")`.

- [ ] **Step 1: Replace `app/admin/page.tsx`** with a server component that reads status:

```tsx
import { getTournament } from "@/lib/supabase/tournament";
import { LifecyclePanel } from "./LifecyclePanel";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const { status } = await getTournament();
  return <LifecyclePanel initialStatus={status} />;
}
```

- [ ] **Step 2: Create `app/admin/LifecyclePanel.tsx`** (client) — status badge + Submit & Start button (Reset added in Task 11):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

const STATUS_LABEL: Record<string, string> = {
  setup: "ĐANG THIẾT LẬP",
  live: "ĐANG DIỄN RA",
  done: "ĐÃ KẾT THÚC",
};

export function LifecyclePanel({ initialStatus }: { initialStatus: "setup" | "live" | "done" }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function start() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("start_tournament");
      if (error) {
        setMsg(`Không thể bắt đầu: ${error.message}`);
        return;
      }
      setStatus("live");
      setMsg("Đã khoá đội hình và bắt đầu giải đấu.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 20, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900 }}>
          Điều khiển giải đấu
        </h2>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, letterSpacing: ".14em", color: "#0B5D4E" }}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p style={{ color: "#5B7A72", fontSize: 14, marginTop: 12 }}>
        Ở trạng thái “thiết lập”, bạn có thể sửa vận động viên và cặp đấu. Bấm bắt đầu để khoá đội hình và cho phép chấm điểm.
      </p>
      <button
        type="button"
        disabled={busy || status !== "setup"}
        onClick={() => void start()}
        style={{
          marginTop: 8,
          height: 48,
          padding: "0 24px",
          borderRadius: 12,
          border: "none",
          background: status === "setup" ? "#3FBF8F" : "rgba(10,31,26,.12)",
          color: status === "setup" ? "#052D22" : "#8AA39C",
          fontWeight: 800,
          fontSize: 14,
          cursor: busy || status !== "setup" ? "not-allowed" : "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
        }}
      >
        Gửi đội hình & bắt đầu giải
      </button>
      {msg && <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx app/admin/LifecyclePanel.tsx
git commit -m "feat(admin): add lifecycle panel with submit & start"
```

---

### Task 11: Reset control (destructive, confirm-gated)

**Files:**
- Modify: `app/admin/LifecyclePanel.tsx`

**Interfaces:**
- Consumes: `reset_tournament` RPC (Task 2).
- Produces: a Reset button that requires an in-panel typed/2-step confirm (no browser `confirm()` dialog — those block the automation harness and are disallowed).

- [ ] **Step 1: Add a two-step confirm reset to `LifecyclePanel`.** Add state `const [confirming, setConfirming] = useState(false);` and a `reset()`:

```tsx
  async function reset() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("reset_tournament");
      if (error) {
        setMsg(`Không thể đặt lại: ${error.message}`);
        return;
      }
      setStatus("setup");
      setConfirming(false);
      setMsg("Đã đặt lại toàn bộ tỉ số. Giải trở về trạng thái thiết lập.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
```

Then render (below the Start button), a danger zone with an explicit two-click confirm — first click reveals the confirm button, second click runs it:

```tsx
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(10,31,26,.1)" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#B0435F" }}>
          VÙNG NGUY HIỂM
        </div>
        <p style={{ color: "#5B7A72", fontSize: 13, marginTop: 8 }}>
          Đặt lại sẽ xoá toàn bộ tỉ số và đưa mọi trận về “sắp diễn ra”. Vận động viên và cặp đấu được giữ nguyên.
        </p>
        {!confirming ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            style={{ marginTop: 8, height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid #B0435F", background: "transparent", color: "#B0435F", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
          >
            Đặt lại giải đấu…
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void reset()}
              style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: "#B0435F", color: "#FFFDF7", fontWeight: 800, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              Xác nhận đặt lại — không thể hoàn tác
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid rgba(10,31,26,.18)", background: "transparent", color: "#3C5A53", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              Huỷ
            </button>
          </div>
        )}
      </div>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/admin/LifecyclePanel.tsx
git commit -m "feat(admin): add confirm-gated tournament reset"
```

---

### Task 12: Avatar upload component

**Files:**
- Create: `components/AvatarUpload.tsx`

**Interfaces:**
- Consumes: `avatars` storage bucket + policies (Task 2).
- Produces: `AvatarUpload({ playerId, currentUrl, onUploaded })` — client component; uploads to `avatars/{playerId}.{ext}` (upsert), then returns the public URL via `onUploaded(url)`.

- [ ] **Step 1: Create `components/AvatarUpload.tsx`**

```tsx
"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

interface IAvatarUploadProps {
  playerId: string;
  currentUrl: string | null;
  onUploaded: (publicUrl: string) => void;
}

export function AvatarUpload({ playerId, currentUrl, onUploaded }: IAvatarUploadProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Chỉ chấp nhận tệp ảnh.");
      return;
    }
    if (file.size > 2_000_000) {
      setErr("Ảnh quá lớn (tối đa 2MB).");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const supabase = createBrowserSupabaseClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${playerId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) {
        setErr(`Tải ảnh thất bại: ${upErr.message}`);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-bust so an overwrite of the same path shows immediately
      onUploaded(`${data.publicUrl}?v=${path.length}-${file.size}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="" width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#C9D6D2" }} />
      )}
      <label style={{ fontSize: 12, fontWeight: 700, color: "#0B5D4E", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Đang tải…" : "Tải ảnh"}
        <input type="file" accept="image/*" onChange={(e) => void handleFile(e)} disabled={busy} style={{ display: "none" }} />
      </label>
      {err && <span style={{ fontSize: 11, color: "#B0435F" }}>{err}</span>}
    </div>
  );
}
```

> Note: uses a plain `<img>` (not `next/image`) because Storage URLs are dynamic and remote — `next/image` would need a configured remote pattern. The public site (`PlayerAvatar`) can keep its own rendering; this is admin-only.

- [ ] **Step 2: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: PASS (the eslint-disable covers the `<img>` rule).

- [ ] **Step 3: Commit**

```bash
git add components/AvatarUpload.tsx
git commit -m "feat(admin): add avatar upload to storage component"
```

---

### Task 13: Players editor

**Files:**
- Create: `app/admin/players/page.tsx`
- Create: `app/admin/players/PlayersEditor.tsx`

**Interfaces:**
- Consumes: `getAdminPlayers()` (Task 8), `validatePlayerName`/`validateTier` (Task 6), `AvatarUpload` (Task 12).
- Produces: per-player row edit (name text, tier 1–4 select, avatar upload) writing `supabase.from("players").update({...}).eq("id", ...).select()`; disabled with a notice when status ≠ `setup`.

- [ ] **Step 1: Create `app/admin/players/page.tsx`** (server):

```tsx
import { getAdminPlayers } from "@/lib/supabase/admin";
import { getTournament } from "@/lib/supabase/tournament";
import { PlayersEditor } from "./PlayersEditor";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  const [players, { status }] = await Promise.all([getAdminPlayers(), getTournament()]);
  return <PlayersEditor initialPlayers={players} editable={status === "setup"} />;
}
```

- [ ] **Step 2: Create `app/admin/players/PlayersEditor.tsx`** (client). Key behaviors: local list state seeded from `initialPlayers`; each row has name input (blur → validate → update), tier `<select>` (change → update), and `<AvatarUpload>` (onUploaded → update `avatar_url`). All writes check `.select()` length (RLS returns 0 rows for non-organizer or non-setup). Show a top banner when `!editable`.

```tsx
"use client";

import { useState } from "react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { validatePlayerName, validateTier } from "@/lib/tournament/adminValidation";
import type { IAdminPlayer } from "@/lib/supabase/admin";

export function PlayersEditor({ initialPlayers, editable }: { initialPlayers: IAdminPlayer[]; editable: boolean }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [msg, setMsg] = useState("");

  async function patch(id: string, patch: Partial<{ name: string; tier: number; avatar_url: string }>) {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.from("players").update(patch).eq("id", id).select();
    if (error) return setMsg(`Lỗi: ${error.message}`);
    if (!data || data.length === 0) return setMsg("Không có quyền, hoặc giải không ở trạng thái thiết lập.");
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...toLocal(patch) } : p)));
    setMsg("Đã lưu.");
  }

  function toLocal(patch: Partial<{ name: string; tier: number; avatar_url: string }>): Partial<IAdminPlayer> {
    return {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.tier !== undefined ? { tier: patch.tier as IAdminPlayer["tier"] } : {}),
      ...(patch.avatar_url !== undefined ? { avatarUrl: patch.avatar_url } : {}),
    };
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>
        Vận động viên
      </h2>
      {!editable && (
        <div style={{ background: "rgba(242,181,68,.16)", border: "1px solid #F2B544", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
          Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 14, padding: 14 }}>
            <AvatarUpload
              playerId={p.id}
              currentUrl={p.avatarUrl ?? (p.avatarKey ? `/avatars/${p.avatarKey}.jpg` : null)}
              onUploaded={(url) => void patch(p.id, { avatar_url: url })}
            />
            <input
              defaultValue={p.name}
              disabled={!editable}
              onBlur={(e) => {
                const err = validatePlayerName(e.target.value);
                if (err) return setMsg(err);
                if (e.target.value.trim() !== p.name) void patch(p.id, { name: e.target.value.trim() });
              }}
              style={{ flex: 1, minWidth: 160, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px", fontFamily: "var(--font-archivo), sans-serif" }}
            />
            <select
              defaultValue={p.tier}
              disabled={!editable}
              onChange={(e) => {
                const tier = Number(e.target.value);
                if (validateTier(tier)) void patch(p.id, { tier });
              }}
              style={{ height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            >
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>Bậc {t}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {msg && <div style={{ marginTop: 14, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin/players/page.tsx app/admin/players/PlayersEditor.tsx
git commit -m "feat(admin): add players editor with name/tier/avatar editing"
```

---

### Task 14: Pairs editor

**Files:**
- Create: `app/admin/pairs/page.tsx`
- Create: `app/admin/pairs/PairsEditor.tsx`

**Interfaces:**
- Consumes: `getAdminPairs()` + `getAdminPlayers()` (Task 8), `validatePairAssignment` (Task 6).
- Produces: per-pair (A–H) two player `<select>`s + name input; writes `supabase.from("pairs").update({ player1_id, player2_id, name }).eq("id", ...).select()`. Letter `code` is read-only (keeps standings ids stable). Editable only in `setup`.

- [ ] **Step 1: Create `app/admin/pairs/page.tsx`** (server):

```tsx
import { getAdminPairs, getAdminPlayers } from "@/lib/supabase/admin";
import { getTournament } from "@/lib/supabase/tournament";
import { PairsEditor } from "./PairsEditor";

export const dynamic = "force-dynamic";

export default async function AdminPairsPage() {
  const [pairs, allPlayers, { status }] = await Promise.all([
    getAdminPairs(),
    getAdminPlayers(),
    getTournament(),
  ]);
  return <PairsEditor initialPairs={pairs} players={allPlayers} editable={status === "setup"} />;
}
```

- [ ] **Step 2: Create `app/admin/pairs/PairsEditor.tsx`** (client):

```tsx
"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { validatePairAssignment } from "@/lib/tournament/adminValidation";
import type { IAdminPair } from "@/lib/supabase/admin";
import type { IAdminPlayer } from "@/lib/supabase/admin";

export function PairsEditor({
  initialPairs,
  players,
  editable,
}: {
  initialPairs: IAdminPair[];
  players: IAdminPlayer[];
  editable: boolean;
}) {
  const [pairs, setPairs] = useState(initialPairs);
  const [msg, setMsg] = useState("");

  function nameFor(id: string): string {
    return players.find((p) => p.id === id)?.name ?? "";
  }

  async function savePair(pair: IAdminPair, next: Partial<IAdminPair>) {
    const merged = { ...pair, ...next };
    const err = validatePairAssignment(merged.player1Id, merged.player2Id);
    if (err) return setMsg(err);
    const supabase = createBrowserSupabaseClient();
    const suggestedName = `${nameFor(merged.player1Id)} – ${nameFor(merged.player2Id)}`;
    const { data, error } = await supabase
      .from("pairs")
      .update({ player1_id: merged.player1Id, player2_id: merged.player2Id, name: merged.name || suggestedName })
      .eq("id", pair.id)
      .select();
    if (error) return setMsg(`Lỗi: ${error.message}`);
    if (!data || data.length === 0) return setMsg("Không có quyền, hoặc giải không ở trạng thái thiết lập.");
    setPairs((prev) => prev.map((p) => (p.id === pair.id ? { ...merged, name: merged.name || suggestedName } : p)));
    setMsg(`Đã lưu cặp ${pair.code}.`);
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>
        Cặp đấu
      </h2>
      {!editable && (
        <div style={{ background: "rgba(242,181,68,.16)", border: "1px solid #F2B544", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
          Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pairs.map((pair) => (
          <div key={pair.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 14, padding: 14 }}>
            <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontWeight: 700, width: 24, color: "#0B5D4E" }}>{pair.code}</span>
            {(["player1Id", "player2Id"] as const).map((slot) => (
              <select
                key={slot}
                defaultValue={pair[slot]}
                disabled={!editable}
                onChange={(e) => void savePair(pair, { [slot]: e.target.value } as Partial<IAdminPair>)}
                style={{ height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px", minWidth: 150 }}
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
            <input
              defaultValue={pair.name}
              disabled={!editable}
              onBlur={(e) => {
                if (e.target.value.trim() !== pair.name) void savePair(pair, { name: e.target.value.trim() });
              }}
              style={{ flex: 1, minWidth: 160, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            />
          </div>
        ))}
      </div>
      {msg && <div style={{ marginTop: 14, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin/pairs/page.tsx app/admin/pairs/PairsEditor.tsx
git commit -m "feat(admin): add pairs editor (player assignment per A-H slot)"
```

---

### Task 15: Rewards editor

**Files:**
- Create: `app/admin/rewards/page.tsx`
- Create: `app/admin/rewards/RewardsEditor.tsx`

**Interfaces:**
- Consumes: `getTournament()` (Task 8), `mergeRewards` (Task 5).
- Produces: 3-row editor (title + detail per place) writing `supabase.from("tournament").update({ rewards }).eq("id", true).select()`.

- [ ] **Step 1: Create `app/admin/rewards/page.tsx`** (server):

```tsx
import { getTournament } from "@/lib/supabase/tournament";
import { RewardsEditor } from "./RewardsEditor";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  const { rewards } = await getTournament();
  return <RewardsEditor initialRewards={rewards} />;
}
```

- [ ] **Step 2: Create `app/admin/rewards/RewardsEditor.tsx`** (client):

```tsx
"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { mergeRewards, type IReward } from "@/lib/tournament/reward";

export function RewardsEditor({ initialRewards }: { initialRewards: IReward[] }) {
  const [rewards, setRewards] = useState(initialRewards);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function edit(place: number, field: "title" | "detail", value: string) {
    setRewards((prev) => prev.map((r) => (r.place === place ? { ...r, [field]: value } : r)));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const supabase = createBrowserSupabaseClient();
      const payload = mergeRewards(rewards);
      const { data, error } = await supabase.from("tournament").update({ rewards: payload }).eq("id", true).select();
      if (error) return setMsg(`Lỗi: ${error.message}`);
      if (!data || data.length === 0) return setMsg("Không có quyền quản trị.");
      setMsg("Đã lưu phần thưởng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>
        Phần thưởng
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rewards.map((r) => (
          <div key={r.place} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 14, padding: 14 }}>
            <span style={{ fontSize: 24 }}>{r.medal}</span>
            <input
              value={r.title}
              onChange={(e) => edit(r.place, "title", e.target.value)}
              placeholder="Tiêu đề phần thưởng"
              style={{ flex: 2, minWidth: 200, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            />
            <input
              value={r.detail}
              onChange={(e) => edit(r.place, "detail", e.target.value)}
              placeholder="Chi tiết"
              style={{ flex: 1, minWidth: 140, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        style={{ marginTop: 16, height: 46, padding: "0 24px", borderRadius: 12, border: "none", background: "#3FBF8F", color: "#052D22", fontWeight: 800, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
      >
        Lưu phần thưởng
      </button>
      {msg && <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin/rewards/page.tsx app/admin/rewards/RewardsEditor.tsx
git commit -m "feat(admin): add rewards editor"
```

---

### Task 16: Public home reads rewards from DB

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getTournament()` (Task 8), `parseRewards` output shape `IReward` (Task 5).
- Produces: the "Phần thưởng" podium rendered from `rewards` (place 1 center/gold, 2 left/silver, 3 right/bronze) instead of hardcoded strings.

- [ ] **Step 1: In `app/page.tsx`, fetch rewards.** The current `HomePage` was refactored to a non-async static shell (per the streaming work). Read the file first. Add `const { rewards } = await getTournament();` — if `HomePage` is non-async, fetch inside the existing `async function HomeLiveData()` is wrong scope (rewards are static, not live). Instead make the rewards podium its own async server piece OR revert the rewards block to read from a small `async` server component `RewardsPodium` wrapped in the existing static shell. Simplest: create the podium markup as a server component `app/RewardsPodium.tsx` that calls `getTournament()` and render it where the hardcoded block is.

Concretely — create `app/RewardsPodium.tsx` (server):

```tsx
import { getTournament } from "@/lib/supabase/tournament";

export async function RewardsPodium() {
  const { rewards } = await getTournament();
  const byPlace = (n: number) => rewards.find((r) => r.place === n) ?? rewards[0];
  const first = byPlace(1);
  const second = byPlace(2);
  const third = byPlace(3);
  // ...render the existing podium markup from app/page.tsx lines ~347-470,
  // substituting: second.title / third.title / first.title for the hardcoded
  // "Huy chương bạc + phần thưởng" / bronze / "Cúp vô địch + phần thưởng chính",
  // and *.detail for the "Sẽ công bố 🎉" lines. Keep all styling identical.
  return (/* moved markup */);
}
```

Then in `app/page.tsx`, replace the inline `{/* Rewards podium */}` block with `<RewardsPodium />` (wrap in `<Suspense>` with a lightweight fallback if `HomePage` is non-async, consistent with how `HomeLiveData` is wrapped).

- [ ] **Step 2: Verify build + that SSR HTML contains the DB reward title**

Run: `npm run build && npm run dev`, then:
```bash
curl -s localhost:3000/ | grep -c "Cúp vô địch"
```
Expected: build PASS; grep ≥ 1 (reward text server-rendered from DB seed).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/RewardsPodium.tsx
git commit -m "feat(admin): render home reward podium from tournament config"
```

---

### Task 17: Organizer-only "Quản trị" header link

**Files:**
- Modify: `components/SiteHeader.tsx`

**Interfaces:**
- Consumes: the header's existing `useRefereeAuth()` `user`; organizer status.
- Produces: a "Quản trị" nav entry visible only to signed-in organizers.

- [ ] **Step 1: Read `components/SiteHeader.tsx`.** It already knows `user` via `useRefereeAuth()`. Organizer status is server-known (`is_organizer()`), not in the client auth context. Add a lightweight client check: on mount, when `user` is set, call `supabase.rpc("is_organizer")` and store a boolean; render the `/admin` link only when true. Add near the other nav items:

```tsx
const [isOrg, setIsOrg] = useState(false);
useEffect(() => {
  if (!user) { setIsOrg(false); return; }
  const supabase = createBrowserSupabaseClient();
  let active = true;
  supabase.rpc("is_organizer").then(({ data }) => { if (active) setIsOrg(data === true); });
  return () => { active = false; };
}, [user]);
```
Then render an extra pill after the mapped `NAV_ITEMS` when `isOrg`:

```tsx
{isOrg && (
  <Link href="/admin" style={{ /* same pill style as NAV_ITEMS, active when pathname.startsWith('/admin') */ }}>
    Quản trị
  </Link>
)}
```

> Rationale: this is a UX convenience only. `/admin` is already server-gated (Task 9) and every write is RLS-gated, so a non-organizer seeing or guessing the link changes nothing.

- [ ] **Step 2: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/SiteHeader.tsx
git commit -m "feat(admin): show admin link to organizers in header"
```

---

### Task 18: Explicit "Bắt đầu trận" (start match) control

**Files:**
- Modify: `app/referee/RefereeScoringPanel.tsx`

**Interfaces:**
- Consumes: existing `commit(state)` path (writes `matches`).
- Produces: a "Bắt đầu trận" button that sets the selected match `state='live'` without changing the score — satisfying "choose a match to start". Disabled when the match is already `live`/`done`.

- [ ] **Step 1: Add a start-match button** next to "Kết thúc trận" in `RefereeScoringPanel.tsx`. Reuse the existing `commit` flow but for `state='live'` at the current draft (which mirrors the stored score):

```tsx
<button
  type="button"
  disabled={saving || activeMatch.state === "live" || activeMatch.state === "done"}
  onClick={() => { void commit("live"); }}
  style={{
    flex: 1, minWidth: 150, height: 50, borderRadius: 12, border: "1px solid #0B5D4E",
    background: "transparent", color: "#0B5D4E", fontSize: 14, fontWeight: 800,
    cursor: saving || activeMatch.state !== "next" ? "not-allowed" : "pointer",
    opacity: activeMatch.state !== "next" ? 0.5 : 1,
    fontFamily: "var(--font-archivo), sans-serif",
  }}
>
  Bắt đầu trận
</button>
```

> Note: `commit("live")` already exists and writes `state:'live'` with the RLS/`.select()` guard; this button just exposes an explicit "start" without needing a ± tap. Scoring writes now require tournament status `'live'` (Task 2) — the DB will reject a start if the tournament isn't live, and the `data.length === 0` guard surfaces the "không có quyền" message. This is correct: you must start the tournament before starting a match.

- [ ] **Step 2: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/referee/RefereeScoringPanel.tsx
git commit -m "feat(admin): add explicit start-match control to referee panel"
```

---

### Task 19: Full authorization proof, cloud SQL handoff, docs

**Files:**
- Modify: `.planning/plans/badminton-championship.md` (mark admin scope delivered)
- Modify: `CLAUDE.md` (note `/admin` area + lifecycle in architecture)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Local RLS/RPC proof (scripted).** With `supabase db reset` applied, run a script (psql) that proves, using an anon/non-organizer role vs. an organizer JWT:
  - anon `select public.reset_tournament()` → error `not authorized`.
  - anon `update players set name='x'` → 0 rows.
  - organizer `update players ...` while status `setup` → 1 row; same update while status `live` → 0 rows (setup gate works).
  - organizer `update matches set score_a=5 where code='M5'` while `live` → 1 row; while `setup` → 0 rows (scoring gate works).
  - `select public.start_tournament()` flips status to `live`; `select public.reset_tournament()` flips to `setup` and zeroes scores.
  Expected: every assertion holds. Capture output.

- [ ] **Step 2: Full app smoke (dev).** Sign in as the seeded organizer (`ngantruc2003@gmail.com`), verify: `/admin` renders (nav visible in header); edit a player name + upload an avatar (setup phase); reassign a pair; Submit & Start → players/pairs editors show the "locked" banner and writes are refused; go to `/referee`, start + score a match (live); `/` shows the score live; edit rewards → `/` podium updates; Reset → scores zeroed, status back to setup. Non-organizer Google account → `/admin` shows denied, no header link.

- [ ] **Step 3: Update docs.** In `.planning/plans/badminton-championship.md`, move "player/pair CRUD", "organizer match/round creation UI (start match)", and "reward editing" from the out-of-scope list to a "Delivered in admin-dashboard plan (2026-08-04)" note. In `CLAUDE.md` architecture, add the `/admin` gated area, the `tournament` lifecycle table, and the `setup`/`live` write-phase gates.

- [ ] **Step 4: Hand off cloud SQL.** Tell the user to paste `supabase/cloud-phase5.sql` into the cloud SQL Editor (and that the `avatars` bucket policies require the storage schema, which the cloud project already has). Note: nothing here is applied to cloud by Claude.

- [ ] **Step 5: Commit**

```bash
git add .planning/plans/badminton-championship.md CLAUDE.md
git commit -m "docs(admin): mark admin dashboard delivered and document lifecycle"
```

---

## Test strategy

- **Unit (Vitest):** pure modules only — `reward.ts` (parse/merge/fallback) and `adminValidation.ts` (name/tier/pair/roster). These carry the branching logic and are fully deterministic. Existing 18 standings tests must stay green (guard against accidental `standings.ts`/id changes).
- **RLS/RPC (scripted SQL, Task 19):** the real authorization boundary — non-organizer refusal, setup-phase roster gate, live-phase scoring gate, start/reset transitions. Proven in Postgres, not just UI.
- **Component wiring:** verified via `npm run build`/`lint` + the manual dev smoke (editors are thin DB-write shells over the tested pure helpers; a Testing-Library harness that mocks the Supabase client would mostly re-assert the mock, so it's intentionally omitted — consistent with the project's existing test surface).
- **E2E smoke (manual, Task 19):** organizer vs non-organizer end-to-end across `/admin`, `/referee`, `/`.

## Risks

- **Scoring gate breaks the live site if status isn't `live`.** Mitigation: seed `tournament.status = 'live'` (Task 1/4); the deployed tournament keeps working. If the user ran an old DB without the row, `getTournament()` falls back to `setup` — which would silently disable scoring. Task 19 Step 4 explicitly has the user run `cloud-phase5.sql`, which inserts the row.
- **`standings.ts` divergence.** Editing pairs changes player composition but **not** the letter `code`, so numeric team ids are stable and standings math is untouched. Pair `code` is read-only in the editor (Task 14) — enforce this; making it editable would break the invariant.
- **Storage RLS vs. public URL.** Bucket is public-read, organizer-write. If a cloud project has stricter storage defaults, uploads may 403 for organizers until `cloud-phase5.sql`'s storage policies are applied — called out in the handoff.
- **Two async server pieces on `/`.** Adding `RewardsPodium` as a second Suspense boundary alongside `HomeLiveData` is fine, but double-check the static shell still streams first (the landing-page partial-skeleton work must not regress). Verify with the Task 16 `curl` check.
- **Client organizer check in the header (Task 17)** adds one `is_organizer()` RPC per signed-in page load. Acceptable (cached session, cheap `stable` function); it only runs when a user is signed in.

## Handoff

Execute with the `fe-plan-executor` agent, task by task, lint/build/tests after each, atomic commits under the user's git identity. SQL migrations are applied locally by the executor (`supabase db reset`); the **user** applies `supabase/cloud-phase5.sql` to the cloud project. Google OAuth + the seeded organizer email are already configured from earlier phases.

---

## Self-Review

**Spec coverage** (each requested capability → task):
- "view list of players and edit name, avatar, tier (1–4)" → Tasks 8, 12, 13.
- "edit the team: who match with who" (pairs only) → Task 14.
- "submit the team, then start the tournament" → Tasks 2 (`start_tournament`), 10.
- "update score of each match, can choose a match to start" → existing `/referee` scoring + Task 18 (explicit start-match) + Task 2 (live-phase gate).
- "reset the whole tournament" (scores only) → Tasks 2 (`reset_tournament`), 11.
- "update the reward" → Tasks 4/5 (config + module), 15 (editor), 16 (public render).
- Cross-cutting: DB foundation (1–4), auth gate (9), types (4), docs/proof (19). ✅ no gap.

**Placeholder scan:** every code step has concrete code. Task 16 Step 1 intentionally says "move the existing podium markup" rather than repasting ~120 lines of inline-styled JSX verbatim — the executor copies the block already in `app/page.tsx:347+` and substitutes 6 named fields (first/second/third `.title`/`.detail`); this is a mechanical move, not a design decision. All other steps are self-contained.

**Type consistency:** `IReward` (reward.ts) used in Tasks 5/8/15/16. `IAdminPlayer`/`IAdminPair` (admin.ts) used in Tasks 8/13/14. `IPlayer.avatarUrl` (Task 7) consumed by `avatarPhotoPath`. RPC names `start_tournament`/`reset_tournament`/`is_setup_phase` consistent across Tasks 2, 4, 10, 11. `tournament` singleton keyed by `id = true` consistent across Tasks 1, 4, 8, 15, 16. Status union `"setup" | "live" | "done"` consistent across Tasks 8, 10, 13, 14. ✅
