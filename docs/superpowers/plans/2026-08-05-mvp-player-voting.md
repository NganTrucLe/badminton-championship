# MVP Player Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a referee run a single time-boxed, passcode-gated MVP vote per tournament in which 16 allow-listed players sign in with Google and anonymously each pick one male and one female MVP, with live turnout for the referee and final winners shown to everyone (and advertised on the landing page as a sport-shirt prize).

**Architecture:** Add a `gender` column to `players` (every player is a candidate) plus four new tables — `mvp_vote` (singleton state: passcode, deadline, status), `mvp_voter_allowlist` (16 eligible emails), `mvp_receipts` (one row per voter — proves participation, no choice) and `mvp_ballots` (choices — gender + candidate, **no voter reference**). Anonymity is structural: a single `SECURITY DEFINER` RPC `cast_mvp_vote()` writes one receipt + two ballots in one transaction, so the app can never join a person to their choice. All reads that must hide the passcode or gate results-by-time go through `SECURITY DEFINER` RPCs (`get_mvp_status`, `get_mvp_results`). Referee turnout is live via Supabase Realtime on `mvp_receipts`. UI follows the existing organizer-gated client-mutation pattern and the landing-page `<Suspense>` streaming pattern.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 (inline-style + CSS-var tokens) · Supabase (`@supabase/ssr`, Postgres + RLS + Realtime + Google OAuth) · Vitest 4 + Testing Library.

## Global Constraints

- **All user-facing copy is Vietnamese.** Match the tone of existing screens.
- **RLS-first / default-deny.** Every new table has explicit RLS. No table is public-writable; every write goes through an organizer-gated policy or a `SECURITY DEFINER` RPC. `mvp_ballots` has **no** SELECT policy for anyone — it is read only via `get_mvp_results()`.
- **Migrations are the only way to change schema.** Files in `supabase/migrations/`, naming `YYYYMMDDHHMMSS_description.sql`. Also add a matching cloud snapshot `supabase/cloud-phase7-mvp-voting.sql` (mirrors the migration verbatim) — this repo keeps parallel `cloud-*.sql` snapshots applied to the cloud project.
- **`SECURITY DEFINER` function template** (copy exactly): `language sql|plpgsql security definer set search_path = public [stable]`, then `revoke all on function ... from public;` and `grant execute on function ... to anon|authenticated;`. Organizer-write RPCs start with `if not public.is_organizer() then raise exception 'not authorized' using errcode = '42501'; end if;`.
- **Types:** `TEXT` not `VARCHAR`; `uuid` PKs via `gen_random_uuid()`; soft-delete via `deleted_at timestamptz` where a domain record can be removed. Singleton tables use `id boolean primary key default true check (id)`.
- **snake_case ↔ camelCase conversion happens only in the data layer** (`lib/supabase/*.ts` mappers). Components consume camelCase interfaces; raw table writes use snake_case inline.
- **Streaming:** any new landing-page section is wrapped in its own `<Suspense>` with a shape-matching skeleton; `page.tsx` never `await`s data before returning markup.
- **Mutations show pending state**; buttons disable while in flight (existing `busy` flag pattern).
- **`npm run build`, `npm run lint`, and `npm run test` must all pass before every commit.**
- **Regenerate/extend `lib/supabase/database.types.ts`** after each migration (hand-edit to match the existing style — the repo maintains this file by hand for `Functions`).
- **Path alias:** `@/*` → repo root. Tests live in co-located `__tests__/` dirs, named `*.test.ts[x]`, run by `vitest run`.

---

## File Structure

**Create:**
- `supabase/migrations/20260805100000_mvp_voting_schema.sql` — gender column, 4 tables, RLS, realtime publication.
- `supabase/migrations/20260805110000_mvp_voting_rpcs.sql` — 8 RPC functions.
- `supabase/cloud-phase7-mvp-voting.sql` — concatenated snapshot of both migrations for the cloud project.
- `lib/tournament/mvp.ts` — framework-free types + pure tally/status logic.
- `lib/tournament/__tests__/mvp.test.ts` — unit tests for the pure logic.
- `lib/supabase/mvp.ts` — typed query/mutation/RPC wrappers (server + client).
- `app/vote/page.tsx` — public voting route (server shell).
- `app/vote/VoteFlow.tsx` — `"use client"` voting flow (login → passcode → pick → submit → result).
- `app/vote/loading.tsx` — route-transition skeleton.
- `app/admin/mvp/page.tsx` — organizer MVP control route (server shell + Suspense).
- `app/admin/mvp/MvpControlPanel.tsx` — `"use client"` start/close/reset + live turnout.
- `app/admin/mvp/MvpVoterAllowlistEditor.tsx` — `"use client"` manage 16 emails.
- `app/MvpPrizeSection.tsx` — landing-page server component (prize blurb + winners when closed).
- `lib/supabase/useMvpTurnout.ts` — `"use client"` Realtime hook for live turnout count.

**Modify:**
- `lib/supabase/database.types.ts` — add table + function types.
- `app/page.tsx` — insert `<Suspense>`-wrapped `<MvpPrizeSection/>`.
- `app/admin/AdminNav.tsx` — add "MVP" tab → `/admin/mvp`.
- `app/admin/players/PlayersEditor.tsx` — add gender selector (editable in `setup`).
- `lib/supabase/admin.ts` — extend `getAdminPlayers()` + `patch` typing to include `gender`.

---

## Interfaces (shared contract — every task depends on these exact names)

TypeScript (defined in Task 3, `lib/tournament/mvp.ts`):

```ts
export type TGender = "male" | "female";
export type TMvpStatus = "idle" | "open" | "closed";

export interface IMvpCandidate {
  id: string;
  name: string;
  gender: TGender;
  tier: TTier;              // reuse existing TTier from lib/tournament/data.ts
  avatarKey: string | null;
  avatarUrl: string | null;
}

export interface IMvpBallotRow { gender: TGender; candidateId: string; votes: number; }

export interface IMvpTally { candidate: IMvpCandidate; votes: number; }

export interface IMvpGenderResult {
  gender: TGender;
  tallies: IMvpTally[];     // sorted votes desc, then name asc
  winners: IMvpCandidate[]; // all candidates tied at max (empty if zero votes)
}

export interface IMvpResults { male: IMvpGenderResult; female: IMvpGenderResult; }

export interface IMvpStatus {
  status: TMvpStatus;       // effective status (already collapses past-deadline → "closed")
  deadline: string | null;  // ISO string
  votedCount: number;
  totalEligible: number;
  isEligible: boolean;      // current signed-in email is on the allow-list
  hasVoted: boolean;        // current signed-in email already has a receipt
}
```

RPC signatures (defined in Task 2):

- `is_mvp_voter() → boolean`
- `verify_mvp_passcode(p_passcode text) → boolean`
- `get_mvp_status() → json` (keys: `status, deadline, voted_count, total_eligible, is_eligible, has_voted`)
- `get_mvp_results() → setof (gender text, candidate_id uuid, votes bigint)` (empty unless effectively closed)
- `cast_mvp_vote(p_passcode text, p_male_id uuid, p_female_id uuid) → void`
- `open_mvp_vote(p_passcode text, p_minutes int) → void` (organizer)
- `close_mvp_vote() → void` (organizer)
- `reset_mvp_vote() → void` (organizer)

---

## Task 1: Database schema — gender column + 4 MVP tables + RLS + realtime

**Files:**
- Create: `supabase/migrations/20260805100000_mvp_voting_schema.sql`
- Verify against: local Postgres via `supabase db reset`

**Interfaces:**
- Produces: tables `mvp_vote`, `mvp_voter_allowlist`, `mvp_receipts`, `mvp_ballots`; `players.gender` column; helper `public.is_mvp_open()`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260805100000_mvp_voting_schema.sql`:

```sql
-- MVP player voting: schema, RLS, realtime.

-- 1. Gender on players (nullable; organizer sets during setup). Candidates need it.
alter table public.players
  add column if not exists gender text
  check (gender is null or gender in ('male', 'female'));

-- 2. Singleton vote state (mirrors public.tournament). Passcode is NEVER client-readable.
create table if not exists public.mvp_vote (
  id boolean primary key default true check (id),
  status text not null default 'idle' check (status in ('idle', 'open', 'closed')),
  passcode text,
  opened_at timestamptz,
  deadline timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.mvp_vote (id) values (true) on conflict (id) do nothing;

-- 3. Allow-list of eligible voter emails (the "16 players").
create table if not exists public.mvp_voter_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

-- 4. Receipts: one row per voter. Proves participation + blocks double-vote. NO choice stored.
create table if not exists public.mvp_receipts (
  email text primary key,
  created_at timestamptz not null default now()
);

-- 5. Ballots: the choices. NO voter reference and NO timestamp (anonymity hardening).
create table if not exists public.mvp_ballots (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('male', 'female')),
  candidate_id uuid not null references public.players(id)
);
create index if not exists mvp_ballots_gender_candidate_idx
  on public.mvp_ballots (gender, candidate_id);

-- Helper: is the vote effectively open right now? (open AND before deadline)
create or replace function public.is_mvp_open()
  returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mvp_vote v
    where v.id = true and v.status = 'open'
      and v.deadline is not null and now() < v.deadline
  );
$$;
revoke all on function public.is_mvp_open() from public;
grant execute on function public.is_mvp_open() to anon, authenticated;

-- RLS: default-deny everywhere; open only what the app truly needs.
alter table public.mvp_vote enable row level security;
alter table public.mvp_voter_allowlist enable row level security;
alter table public.mvp_receipts enable row level security;
alter table public.mvp_ballots enable row level security;

-- mvp_vote: organizer may SELECT (needs passcode to manage); no public select (passcode secret).
--           No direct write policy — writes go only through RPCs.
create policy "organizers read mvp_vote" on public.mvp_vote
  for select using (public.is_organizer());

-- mvp_voter_allowlist: organizer full manage; no anon access (eligibility via is_mvp_voter()).
create policy "organizers read allowlist" on public.mvp_voter_allowlist
  for select using (public.is_organizer());
create policy "organizers insert allowlist" on public.mvp_voter_allowlist
  for insert with check (public.is_organizer());
create policy "organizers delete allowlist" on public.mvp_voter_allowlist
  for delete using (public.is_organizer());

-- mvp_receipts: organizer may SELECT (live turnout + realtime). Inserts only via RPC.
create policy "organizers read receipts" on public.mvp_receipts
  for select using (public.is_organizer());

-- mvp_ballots: NO policies at all -> default deny for everyone. Read only via get_mvp_results().

-- Realtime: referee turnout subscribes to receipt inserts (organizer has SELECT).
alter publication supabase_realtime add table public.mvp_receipts;
```

- [ ] **Step 2: Apply locally and verify it resets cleanly**

Run: `supabase db reset`
Expected: all migrations apply with no error; final line reports success. If `supabase` CLI is unavailable, note it and hand this step to someone who can run local Postgres (the RLS/RPC layer must be proven against real Postgres, per project convention).

- [ ] **Step 3: Verify structure + default-deny with psql assertions**

Run (against the local DB — connection string from `supabase status`):

```sql
-- gender column exists and is constrained
select column_name from information_schema.columns
  where table_name='players' and column_name='gender';           -- 1 row

-- singleton seeded
select id, status from public.mvp_vote;                           -- (true, idle)

-- ballots is default-deny (no policies)
select count(*) from pg_policies where tablename='mvp_ballots';   -- 0

-- receipts + allowlist + vote each have organizer policies
select tablename, count(*) from pg_policies
  where tablename in ('mvp_vote','mvp_voter_allowlist','mvp_receipts')
  group by tablename;                                             -- vote:1, allowlist:3, receipts:1

-- realtime publication includes receipts
select 1 from pg_publication_tables
  where pubname='supabase_realtime' and tablename='mvp_receipts'; -- 1 row
```
Expected: each assertion returns the commented result.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805100000_mvp_voting_schema.sql
git commit -m "feat(mvp): add gender column and MVP voting schema with RLS"
```

---

## Task 2: Database RPCs — eligibility, status, results, cast, and organizer controls

**Files:**
- Create: `supabase/migrations/20260805110000_mvp_voting_rpcs.sql`
- Verify against: local Postgres

**Interfaces:**
- Consumes: tables + `is_organizer()`, `is_mvp_open()` from Task 1.
- Produces: the 8 RPCs listed in the shared Interfaces section.

- [ ] **Step 1: Write the RPC migration SQL**

Create `supabase/migrations/20260805110000_mvp_voting_rpcs.sql`:

```sql
-- MVP voting: RPC surface. All SECURITY DEFINER, search_path pinned.

-- Is the current auth email on the allow-list?
create or replace function public.is_mvp_voter()
  returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mvp_voter_allowlist a
    where a.email = auth.jwt() ->> 'email'
  );
$$;
revoke all on function public.is_mvp_voter() from public;
grant execute on function public.is_mvp_voter() to anon, authenticated;

-- Passcode gate for the UI (does NOT record anything).
create or replace function public.verify_mvp_passcode(p_passcode text)
  returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mvp_vote v
    where v.id = true and v.status = 'open'
      and v.deadline is not null and now() < v.deadline
      and v.passcode = p_passcode
  );
$$;
revoke all on function public.verify_mvp_passcode(text) from public;
grant execute on function public.verify_mvp_passcode(text) to authenticated;

-- Public status snapshot. Excludes passcode. Collapses past-deadline -> 'closed'.
create or replace function public.get_mvp_status()
  returns json language sql security definer set search_path = public stable
as $$
  select json_build_object(
    'status', case
        when v.status = 'open' and (v.deadline is null or now() >= v.deadline) then 'closed'
        else v.status end,
    'deadline', v.deadline,
    'voted_count', (select count(*) from public.mvp_receipts),
    'total_eligible', (select count(*) from public.mvp_voter_allowlist),
    'is_eligible', public.is_mvp_voter(),
    'has_voted', exists (
        select 1 from public.mvp_receipts r where r.email = auth.jwt() ->> 'email')
  )
  from public.mvp_vote v where v.id = true;
$$;
revoke all on function public.get_mvp_status() from public;
grant execute on function public.get_mvp_status() to anon, authenticated;

-- Tallies. Returns rows ONLY when effectively closed; empty while idle/open.
create or replace function public.get_mvp_results()
  returns table (gender text, candidate_id uuid, votes bigint)
  language sql security definer set search_path = public stable
as $$
  select b.gender, b.candidate_id, count(*)::bigint as votes
  from public.mvp_ballots b
  where exists (
    select 1 from public.mvp_vote v
    where v.id = true
      and (v.status = 'closed'
        or (v.status = 'open' and v.deadline is not null and now() >= v.deadline))
  )
  group by b.gender, b.candidate_id;
$$;
revoke all on function public.get_mvp_results() from public;
grant execute on function public.get_mvp_results() to anon, authenticated;

-- Cast a ballot: 1 receipt + 2 ballots, atomic. Enforces eligibility, passcode, window, no-double.
create or replace function public.cast_mvp_vote(
  p_passcode text, p_male_id uuid, p_female_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
begin
  if v_email is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;
  if not public.is_mvp_voter() then
    raise exception 'not eligible to vote' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.mvp_vote v
    where v.id = true and v.status = 'open'
      and v.deadline is not null and now() < v.deadline
      and v.passcode = p_passcode
  ) then
    raise exception 'voting is not open or passcode is wrong' using errcode = '42501';
  end if;
  if exists (select 1 from public.mvp_receipts r where r.email = v_email) then
    raise exception 'already voted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.players p
      where p.id = p_male_id and p.gender = 'male' and p.deleted_at is null) then
    raise exception 'invalid male candidate' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players p
      where p.id = p_female_id and p.gender = 'female' and p.deleted_at is null) then
    raise exception 'invalid female candidate' using errcode = '22023';
  end if;

  insert into public.mvp_receipts (email) values (v_email);
  insert into public.mvp_ballots (gender, candidate_id)
    values ('male', p_male_id), ('female', p_female_id);
end;
$$;
revoke all on function public.cast_mvp_vote(text, uuid, uuid) from public;
grant execute on function public.cast_mvp_vote(text, uuid, uuid) to authenticated;

-- Organizer: open a fresh vote. Wipes prior receipts/ballots so re-runs start clean.
create or replace function public.open_mvp_vote(p_passcode text, p_minutes int)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_passcode is null or length(trim(p_passcode)) = 0 then
    raise exception 'passcode required' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'minutes must be positive' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players
      where gender = 'male' and deleted_at is null) then
    raise exception 'no male candidates' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players
      where gender = 'female' and deleted_at is null) then
    raise exception 'no female candidates' using errcode = '22023';
  end if;

  delete from public.mvp_ballots;
  delete from public.mvp_receipts;
  update public.mvp_vote
    set status = 'open', passcode = p_passcode,
        opened_at = now(), deadline = now() + make_interval(mins => p_minutes),
        updated_at = now()
    where id = true;
end;
$$;
revoke all on function public.open_mvp_vote(text, int) from public;
grant execute on function public.open_mvp_vote(text, int) to authenticated;

-- Organizer: end the vote now (results become visible).
create or replace function public.close_mvp_vote()
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.mvp_vote set status = 'closed', updated_at = now() where id = true;
end;
$$;
revoke all on function public.close_mvp_vote() from public;
grant execute on function public.close_mvp_vote() to authenticated;

-- Organizer: reset to idle and clear all votes.
create or replace function public.reset_mvp_vote()
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.mvp_ballots;
  delete from public.mvp_receipts;
  update public.mvp_vote
    set status = 'idle', passcode = null, opened_at = null, deadline = null,
        updated_at = now()
    where id = true;
end;
$$;
revoke all on function public.reset_mvp_vote() from public;
grant execute on function public.reset_mvp_vote() to authenticated;
```

- [ ] **Step 2: Apply locally**

Run: `supabase db reset`
Expected: applies clean.

- [ ] **Step 3: Verify RPC behavior with a psql scenario**

Run this scenario against local Postgres (simulates the full happy path + guards; adjust the two player UUIDs to real seeded rows and set genders first):

```sql
-- setup: give two seeded players genders + add a voter
update public.players set gender='male'   where id='<PLAYER_M>';
update public.players set gender='female' where id='<PLAYER_F>';
insert into public.mvp_voter_allowlist (email) values ('voter@example.com');

-- results hidden while idle
select count(*) from public.get_mvp_results();                    -- 0

-- open as organizer (run with a JWT whose email is in organizers; via app or set request.jwt.claims)
select public.open_mvp_vote('1234', 60);
select status, (deadline > now()) from public.mvp_vote;           -- open, t

-- results still hidden while open
select count(*) from public.get_mvp_results();                    -- 0

-- (as voter@example.com) cast a vote, then double-vote is blocked
select public.cast_mvp_vote('1234', '<PLAYER_M>', '<PLAYER_F>');  -- ok
select public.cast_mvp_vote('1234', '<PLAYER_M>', '<PLAYER_F>');  -- ERROR: already voted
select count(*) from public.mvp_receipts;                         -- 1
select count(*) from public.mvp_ballots;                          -- 2

-- close -> results visible
select public.close_mvp_vote();
select gender, votes from public.get_mvp_results() order by gender; -- female:1, male:1
```
Expected: each assertion matches the comment; `cast_mvp_vote` with a wrong passcode or a non-allow-listed email raises `42501`.

> **Note on JWT in psql:** to exercise `auth.jwt()`-dependent functions locally, wrap calls in a transaction that sets the claim, e.g. `set local request.jwt.claims = '{"email":"voter@example.com"}';` before the `cast_mvp_vote` call, and an organizer email before `open_mvp_vote`. If running these through the app instead of psql, sign in as each role.

- [ ] **Step 4: Create the cloud snapshot**

Create `supabase/cloud-phase7-mvp-voting.sql` containing the **concatenation** of `20260805100000_mvp_voting_schema.sql` followed by `20260805110000_mvp_voting_rpcs.sql` (verbatim), so it can be applied to the cloud project in one paste — matching the existing `cloud-*.sql` snapshot practice.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805110000_mvp_voting_rpcs.sql supabase/cloud-phase7-mvp-voting.sql
git commit -m "feat(mvp): add MVP voting RPCs (cast, status, results, organizer controls)"
```

---

## Task 3: Pure logic + TypeScript types (`lib/tournament/mvp.ts`) with tests

**Files:**
- Create: `lib/tournament/mvp.ts`
- Test: `lib/tournament/__tests__/mvp.test.ts`

**Interfaces:**
- Consumes: `TTier` from `lib/tournament/data.ts`.
- Produces: all types in the shared Interfaces section + pure fns `effectiveStatus`, `groupCandidatesByGender`, `tallyBallots`, `computeWinners`, `isResultsVisible`.

- [ ] **Step 1: Write the failing tests**

Create `lib/tournament/__tests__/mvp.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeWinners,
  effectiveStatus,
  groupCandidatesByGender,
  isResultsVisible,
  tallyBallots,
  type IMvpCandidate,
} from "@/lib/tournament/mvp";

const cand = (id: string, gender: "male" | "female", name: string): IMvpCandidate => ({
  id, name, gender, tier: 1, avatarKey: null, avatarUrl: null,
});

const m1 = cand("m1", "male", "Alan");
const m2 = cand("m2", "male", "Bob");
const f1 = cand("f1", "female", "Cara");
const f2 = cand("f2", "female", "Dana");

describe("effectiveStatus", () => {
  const now = new Date("2026-08-05T10:00:00Z");
  it("returns idle/closed unchanged", () => {
    expect(effectiveStatus("idle", null, now)).toBe("idle");
    expect(effectiveStatus("closed", null, now)).toBe("closed");
  });
  it("keeps open before the deadline", () => {
    expect(effectiveStatus("open", "2026-08-05T10:05:00Z", now)).toBe("open");
  });
  it("collapses open past the deadline to closed", () => {
    expect(effectiveStatus("open", "2026-08-05T09:59:00Z", now)).toBe("closed");
  });
});

describe("isResultsVisible", () => {
  it("is true only when closed", () => {
    expect(isResultsVisible("closed")).toBe(true);
    expect(isResultsVisible("open")).toBe(false);
    expect(isResultsVisible("idle")).toBe(false);
  });
});

describe("groupCandidatesByGender", () => {
  it("splits and preserves order", () => {
    const g = groupCandidatesByGender([m1, f1, m2, f2]);
    expect(g.male.map((c) => c.id)).toEqual(["m1", "m2"]);
    expect(g.female.map((c) => c.id)).toEqual(["f1", "f2"]);
  });
});

describe("tallyBallots", () => {
  const candidates = [m1, m2, f1, f2];
  const rows = [
    { gender: "male" as const, candidateId: "m1", votes: 3 },
    { gender: "male" as const, candidateId: "m2", votes: 1 },
    { gender: "female" as const, candidateId: "f2", votes: 2 },
  ];
  it("sorts each gender by votes desc then name asc and joins candidate data", () => {
    const r = tallyBallots(candidates, rows);
    expect(r.male.tallies.map((t) => [t.candidate.id, t.votes])).toEqual([["m1", 3], ["m2", 1]]);
    expect(r.male.winners.map((c) => c.id)).toEqual(["m1"]);
    expect(r.female.tallies.map((t) => [t.candidate.id, t.votes])).toEqual([["f2", 2], ["f1", 0]]);
    expect(r.female.winners.map((c) => c.id)).toEqual(["f2"]);
  });
  it("returns no winners when nobody has votes", () => {
    const r = tallyBallots(candidates, []);
    expect(r.male.winners).toEqual([]);
    expect(r.female.winners).toEqual([]);
  });
});

describe("computeWinners", () => {
  it("returns all candidates tied at the max (>0)", () => {
    const tallies = [
      { candidate: m1, votes: 2 },
      { candidate: m2, votes: 2 },
    ];
    expect(computeWinners(tallies).map((c) => c.id)).toEqual(["m1", "m2"]);
  });
  it("returns empty when max is zero", () => {
    expect(computeWinners([{ candidate: m1, votes: 0 }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- mvp`
Expected: FAIL — cannot resolve `@/lib/tournament/mvp`.

- [ ] **Step 3: Implement `lib/tournament/mvp.ts`**

```ts
import type { TTier } from "@/lib/tournament/data";

export type TGender = "male" | "female";
export type TMvpStatus = "idle" | "open" | "closed";

export interface IMvpCandidate {
  id: string;
  name: string;
  gender: TGender;
  tier: TTier;
  avatarKey: string | null;
  avatarUrl: string | null;
}

export interface IMvpBallotRow {
  gender: TGender;
  candidateId: string;
  votes: number;
}

export interface IMvpTally {
  candidate: IMvpCandidate;
  votes: number;
}

export interface IMvpGenderResult {
  gender: TGender;
  tallies: IMvpTally[];
  winners: IMvpCandidate[];
}

export interface IMvpResults {
  male: IMvpGenderResult;
  female: IMvpGenderResult;
}

export interface IMvpStatus {
  status: TMvpStatus;
  deadline: string | null;
  votedCount: number;
  totalEligible: number;
  isEligible: boolean;
  hasVoted: boolean;
}

export function effectiveStatus(
  raw: TMvpStatus,
  deadline: string | null,
  now: Date,
): TMvpStatus {
  if (raw === "open" && (deadline === null || now.getTime() >= new Date(deadline).getTime())) {
    return "closed";
  }
  return raw;
}

export function isResultsVisible(status: TMvpStatus): boolean {
  return status === "closed";
}

export function groupCandidatesByGender(candidates: IMvpCandidate[]): {
  male: IMvpCandidate[];
  female: IMvpCandidate[];
} {
  return {
    male: candidates.filter((c) => c.gender === "male"),
    female: candidates.filter((c) => c.gender === "female"),
  };
}

export function computeWinners(tallies: IMvpTally[]): IMvpCandidate[] {
  const max = tallies.reduce((acc, t) => Math.max(acc, t.votes), 0);
  if (max === 0) return [];
  return tallies.filter((t) => t.votes === max).map((t) => t.candidate);
}

function buildGenderResult(
  gender: TGender,
  candidates: IMvpCandidate[],
  votesById: Map<string, number>,
): IMvpGenderResult {
  const tallies: IMvpTally[] = candidates
    .filter((c) => c.gender === gender)
    .map((candidate) => ({ candidate, votes: votesById.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.candidate.name.localeCompare(b.candidate.name));
  return { gender, tallies, winners: computeWinners(tallies) };
}

export function tallyBallots(
  candidates: IMvpCandidate[],
  rows: IMvpBallotRow[],
): IMvpResults {
  const votesById = new Map<string, number>();
  for (const row of rows) votesById.set(row.candidateId, row.votes);
  return {
    male: buildGenderResult("male", candidates, votesById),
    female: buildGenderResult("female", candidates, votesById),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- mvp`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/mvp.ts lib/tournament/__tests__/mvp.test.ts
git commit -m "feat(mvp): add pure MVP tally and status logic with tests"
```

---

## Task 4: Data layer (`lib/supabase/mvp.ts`) — typed reads, RPC wrappers, mutations

**Files:**
- Create: `lib/supabase/mvp.ts`
- Modify: `lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: types + `tallyBallots` from Task 3; RPCs from Task 2; the three Supabase clients (`createServerSupabaseClient`, `createAuthServerClient`, `createBrowserSupabaseClient`).
- Produces: `getMvpCandidates`, `getMvpStatus`, `getMvpResults` (server); `castMvpVote`, `verifyMvpPasscode`, `openMvpVote`, `closeMvpVote`, `resetMvpVote`, `getMvpVoterAllowlist`, `addMvpVoter`, `removeMvpVoter` (client/RPC).

- [ ] **Step 1: Extend `database.types.ts`**

In `lib/supabase/database.types.ts`, add to the `public.Tables` block (matching the existing generated shape) entries for `mvp_vote`, `mvp_voter_allowlist`, `mvp_receipts`, `mvp_ballots`, add `gender: string | null` to `players` Row/Insert/Update, and add to the `Functions` block: `is_mvp_voter`, `is_mvp_open`, `verify_mvp_passcode`, `get_mvp_status`, `get_mvp_results`, `cast_mvp_vote`, `open_mvp_vote`, `close_mvp_vote`, `reset_mvp_vote` with argument/return types mirroring Task 2. Follow the exact style of the existing `is_organizer` / `start_tournament` declarations already in the file. If the Supabase CLI is available, prefer `supabase gen types typescript --local > lib/supabase/database.types.ts` and then re-check the file compiles.

- [ ] **Step 2: Write the data-layer module**

Create `lib/supabase/mvp.ts`:

```ts
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

// Returns null while not closed; otherwise male/female results with winners.
export async function getMvpResults(): Promise<IMvpResults | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_mvp_results");
  if (error) throw new Error(`Failed to load MVP results: ${error.message}`);
  const rows = (data ?? []) as { gender: TGender; candidate_id: string; votes: number }[];
  if (rows.length === 0) {
    // Could be genuinely no ballots yet OR not closed. Caller decides via status.
    // Still return a zero-result so a closed-with-no-votes state renders "no winner".
  }
  const candidates = await getMvpCandidates();
  return tallyBallots(
    candidates,
    rows.map((r) => ({ gender: r.gender, candidateId: r.candidate_id, votes: Number(r.votes) })),
  );
}
```

Then create the **client** helpers (they use the browser client, so keep them in a separate `"use client"`-safe module to avoid the `server-only` import). Create `lib/supabase/mvpClient.ts`:

```ts
"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

export async function verifyMvpPasscode(passcode: string): Promise<boolean> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("verify_mvp_passcode", { p_passcode: passcode });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function castMvpVote(passcode: string, maleId: string, femaleId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("cast_mvp_vote", {
    p_passcode: passcode, p_male_id: maleId, p_female_id: femaleId,
  });
  if (error) throw new Error(error.message);
}

export async function openMvpVote(passcode: string, minutes: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("open_mvp_vote", { p_passcode: passcode, p_minutes: minutes });
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

// Returns "denied" when RLS filters the write to 0 rows (non-organizer), mirroring
// the codebase convention of treating an empty write result as "no permission".
export async function addMvpVoter(email: string): Promise<"ok" | "denied"> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("mvp_voter_allowlist").insert({ email }).select();
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? "ok" : "denied";
}

export async function removeMvpVoter(email: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("mvp_voter_allowlist").delete().eq("email", email);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Verify it type-checks and builds**

Run: `npm run build`
Expected: build succeeds; no TypeScript errors referencing the new RPCs or `gender` (this proves the `database.types.ts` additions are consistent).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/mvp.ts lib/supabase/mvpClient.ts lib/supabase/database.types.ts
git commit -m "feat(mvp): add MVP voting data layer and RPC wrappers"
```

---

## Task 5: Players editor — gender selector

**Files:**
- Modify: `app/admin/players/PlayersEditor.tsx`
- Modify: `lib/supabase/admin.ts` (add `gender` to `getAdminPlayers` + the `IAdminPlayer` interface)

**Interfaces:**
- Consumes: existing `patch()` write pattern in `PlayersEditor.tsx` (`players.update(...).eq("id", ...).select()`), editable only when tournament `status === "setup"`.
- Produces: organizer can set each player's gender during setup (required before a vote can open).

- [ ] **Step 1: Add `gender` to the admin player interface + query**

In `lib/supabase/admin.ts`: add `gender: "male" | "female" | null` to `IAdminPlayer`; add `gender` to the `.select(...)` string in `getAdminPlayers()`; map `gender: p.gender as "male" | "female" | null` in the returned object.

- [ ] **Step 2: Add the gender selector to the editor**

In `app/admin/players/PlayersEditor.tsx`, next to the existing tier control for each player row, add a `<select>` bound to the player's gender, disabled when `!editable` (i.e. `status !== "setup"`), that calls the existing per-field `patch(id, { gender: value })` helper. Match the existing inline-style + Vietnamese-label convention. Values: `""` (Chưa chọn), `"male"` (Nam), `"female"` (Nữ). When the empty option is chosen, write `gender: null`.

```tsx
<label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
  <span style={{ fontSize: 12, color: "#6b6b6b" }}>Giới tính</span>
  <select
    value={player.gender ?? ""}
    disabled={!editable || busyId === player.id}
    onChange={(e) =>
      patch(player.id, { gender: e.target.value === "" ? null : (e.target.value as "male" | "female") })
    }
    style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
  >
    <option value="">Chưa chọn</option>
    <option value="male">Nam</option>
    <option value="female">Nữ</option>
  </select>
</label>
```
(Match the existing `patch`/`busyId` names actually used in the file; if they differ, adapt to the real handler.)

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build`
Expected: succeeds. Manual: on `/admin/players` during `setup`, the gender selector is editable and persists; once the tournament is `live`, it is disabled (RLS on `players` already blocks non-setup writes — confirm a write attempt yields no change).

- [ ] **Step 4: Commit**

```bash
git add app/admin/players/PlayersEditor.tsx lib/supabase/admin.ts
git commit -m "feat(mvp): add player gender selector to admin players editor"
```

---

## Task 6: Referee MVP control panel (`/admin/mvp`) + live turnout + allow-list editor

**Files:**
- Create: `app/admin/mvp/page.tsx`
- Create: `app/admin/mvp/MvpControlPanel.tsx`
- Create: `app/admin/mvp/MvpVoterAllowlistEditor.tsx`
- Create: `lib/supabase/useMvpTurnout.ts`
- Modify: `app/admin/AdminNav.tsx`

**Interfaces:**
- Consumes: `getMvpStatus` (Task 4, server), `openMvpVote`/`closeMvpVote`/`resetMvpVote`/`getMvpVoterAllowlist`/`addMvpVoter`/`removeMvpVoter` (Task 4, client), the `AdminSectionSkeleton` fallback, and the `<Countdown target=.../>` component.
- Produces: the organizer surface for the whole feature.

- [ ] **Step 1: Add the nav tab**

In `app/admin/AdminNav.tsx`, add a tab `{ href: "/admin/mvp", label: "Bình chọn MVP" }` after the existing tabs, matching the existing tab-array shape and active-state styling.

- [ ] **Step 2: Realtime turnout hook**

Create `lib/supabase/useMvpTurnout.ts`:

```ts
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
```

- [ ] **Step 3: Control panel component**

Create `app/admin/mvp/MvpControlPanel.tsx` (`"use client"`). It renders one of three states from the initial `status`, drives the RPCs, and shows live turnout + countdown when open. Include pending/`busy` state on every button.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { useMvpTurnout } from "@/lib/supabase/useMvpTurnout";
import { closeMvpVote, openMvpVote, resetMvpVote } from "@/lib/supabase/mvpClient";
import type { IMvpStatus } from "@/lib/tournament/mvp";

export function MvpControlPanel({ initial }: { initial: IMvpStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [minutes, setMinutes] = useState(10);
  const { votedCount, totalEligible } = useMvpTurnout(initial.votedCount, initial.totalEligible);

  async function run(action: () => Promise<void>, ok: () => void) {
    setBusy(true); setMsg(null);
    try { await action(); ok(); router.refresh(); }
    catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  if (initial.status === "open") {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontFamily: "var(--font-bricolage)" }}>Đang bình chọn</h2>
        <p style={{ fontFamily: "var(--font-jetbrains)", fontSize: 28 }}>
          {votedCount} / {totalEligible} người đã bình chọn
        </p>
        {initial.deadline && <Countdown target={new Date(initial.deadline)} />}
        <button disabled={busy}
          onClick={() => run(closeMvpVote, () => setMsg("Đã kết thúc."))}
          style={{ padding: "10px 16px", borderRadius: 10, background: "var(--color-live)", color: "#fff", border: "none" }}>
          {busy ? "Đang xử lý…" : "Kết thúc bình chọn"}
        </button>
        {msg && <p>{msg}</p>}
      </section>
    );
  }

  if (initial.status === "closed") {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontFamily: "var(--font-bricolage)" }}>Bình chọn đã kết thúc</h2>
        <p>Kết quả đã hiển thị công khai trên trang chủ.</p>
        <button disabled={busy}
          onClick={() => run(resetMvpVote, () => setMsg("Đã đặt lại."))}
          style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #ccc", background: "#fff" }}>
          {busy ? "Đang xử lý…" : "Đặt lại để bình chọn mới"}
        </button>
        {msg && <p>{msg}</p>}
      </section>
    );
  }

  // idle
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontFamily: "var(--font-bricolage)" }}>Bắt đầu bình chọn MVP</h2>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span>Mã bình chọn (passcode)</span>
        <input value={passcode} onChange={(e) => setPasscode(e.target.value)}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span>Thời gian (phút)</span>
        <input type="number" min={1} value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", width: 120 }} />
      </label>
      <button disabled={busy || passcode.trim() === "" || minutes < 1}
        onClick={() => run(() => openMvpVote(passcode.trim(), minutes), () => { setPasscode(""); })}
        style={{ padding: "10px 16px", borderRadius: 10, background: "var(--color-primary)", color: "#fff", border: "none" }}>
        {busy ? "Đang mở…" : "Mở bình chọn"}
      </button>
      {msg && <p>{msg}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Allow-list editor**

Create `app/admin/mvp/MvpVoterAllowlistEditor.tsx` (`"use client"`): loads emails via `getMvpVoterAllowlist()` in an effect, shows the list with a remove button per email and an add-email input. Disable editing when `status === "open"` (pass `disabled` prop). Handle `addMvpVoter` returning `"denied"` by showing "Không có quyền quản trị." Show a `X / 16` hint. Follow the same inline-style + `busy` conventions as the control panel. Validate the email is non-empty and contains `@` before calling `addMvpVoter`.

```tsx
"use client";

import { useEffect, useState } from "react";
import { addMvpVoter, getMvpVoterAllowlist, removeMvpVoter } from "@/lib/supabase/mvpClient";

export function MvpVoterAllowlistEditor({ disabled }: { disabled: boolean }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { void getMvpVoterAllowlist().then(setEmails).catch(() => {}); }, []);

  async function add() {
    const email = input.trim().toLowerCase();
    if (!email.includes("@")) { setMsg("Email không hợp lệ."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await addMvpVoter(email);
      if (res === "denied") { setMsg("Không có quyền quản trị."); return; }
      setEmails((prev) => Array.from(new Set([...prev, email])).sort());
      setInput("");
    } catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  async function remove(email: string) {
    setBusy(true); setMsg(null);
    try { await removeMvpVoter(email); setEmails((p) => p.filter((e) => e !== email)); }
    catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ fontFamily: "var(--font-bricolage)" }}>
        Người bình chọn ({emails.length}/16)
      </h3>
      {!disabled && (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="email@gmail.com"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
          <button disabled={busy} onClick={add}
            style={{ padding: "8px 14px", borderRadius: 8, background: "var(--color-primary)", color: "#fff", border: "none" }}>
            Thêm
          </button>
        </div>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {emails.map((email) => (
          <li key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "var(--color-cream)", borderRadius: 8 }}>
            <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 13 }}>{email}</span>
            {!disabled && (
              <button disabled={busy} onClick={() => remove(email)}
                style={{ border: "none", background: "none", color: "var(--color-live)", cursor: "pointer" }}>
                Xóa
              </button>
            )}
          </li>
        ))}
      </ul>
      {disabled && <p style={{ fontSize: 12, color: "#6b6b6b" }}>Không thể sửa khi đang bình chọn.</p>}
      {msg && <p>{msg}</p>}
    </section>
  );
}
```

- [ ] **Step 5: The page (server shell + Suspense)**

Create `app/admin/mvp/page.tsx`:

```tsx
import { Suspense } from "react";
import { AdminSectionSkeleton } from "@/app/admin/AdminSectionSkeleton";
import { getMvpStatus } from "@/lib/supabase/mvp";
import { MvpControlPanel } from "./MvpControlPanel";
import { MvpVoterAllowlistEditor } from "./MvpVoterAllowlistEditor";

export const dynamic = "force-dynamic";

async function MvpAdminData() {
  const status = await getMvpStatus();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <MvpControlPanel initial={status} />
      <MvpVoterAllowlistEditor disabled={status.status === "open"} />
    </div>
  );
}

export default function MvpAdminPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton />}>
      <MvpAdminData />
    </Suspense>
  );
}
```
(Confirm the exact import path/name of `AdminSectionSkeleton` against the existing admin pages and match it.)

- [ ] **Step 6: Verify build + manual walkthrough**

Run: `npm run build`
Expected: succeeds. Manual: as an organizer, `/admin/mvp` shows the idle start form + allow-list editor; adding an email updates `X/16`; opening a vote (with genders set on players) flips to the live turnout view with countdown; casting a vote from another browser increments turnout live; "Kết thúc" flips to closed.

- [ ] **Step 7: Commit**

```bash
git add app/admin/mvp lib/supabase/useMvpTurnout.ts app/admin/AdminNav.tsx
git commit -m "feat(mvp): add referee MVP control panel with live turnout and allow-list editor"
```

---

## Task 7: Public voting flow (`/vote`)

**Files:**
- Create: `app/vote/page.tsx`
- Create: `app/vote/VoteFlow.tsx`
- Create: `app/vote/loading.tsx`

**Interfaces:**
- Consumes: `getMvpStatus` + `getMvpCandidates` (Task 4, server); `verifyMvpPasscode` + `castMvpVote` (Task 4, client); `RefereeAuthContext` (`user`, `loading`, `signInWithGoogle(next)`); `groupCandidatesByGender`, `PlayerAvatar`.
- Produces: the end-to-end voter experience.

- [ ] **Step 1: Route-transition skeleton**

Create `app/vote/loading.tsx` returning a simple card-shaped skeleton (reuse `Skeleton` from `components/Skeleton.tsx`) that mirrors the vote card layout.

- [ ] **Step 2: Server shell**

Create `app/vote/page.tsx`:

```tsx
import { Suspense } from "react";
import { getMvpCandidates, getMvpStatus } from "@/lib/supabase/mvp";
import { groupCandidatesByGender } from "@/lib/tournament/mvp";
import { VoteFlow } from "./VoteFlow";
import { Skeleton } from "@/components/Skeleton";

export const dynamic = "force-dynamic";

async function VoteData() {
  const [status, candidates] = await Promise.all([getMvpStatus(), getMvpCandidates()]);
  const { male, female } = groupCandidatesByGender(candidates);
  return <VoteFlow status={status} male={male} female={female} />;
}

export default function VotePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontFamily: "var(--font-bricolage)" }}>Bình chọn MVP</h1>
      <Suspense fallback={<Skeleton style={{ height: 320 }} />}>
        <VoteData />
      </Suspense>
    </main>
  );
}
```
(Match `Skeleton`'s real prop API — check `components/Skeleton.tsx`.)

- [ ] **Step 3: The client flow**

Create `app/vote/VoteFlow.tsx` (`"use client"`). It is a small state machine over the initial `status`:

1. `status.status === "idle"` → "Chưa có đợt bình chọn nào." (nothing to do).
2. `status.status === "closed"` → "Bình chọn đã kết thúc. Xem kết quả trên trang chủ." + link to `/`.
3. `status.status === "open"`:
   - If `!user` (from `useRefereeAuth`) → "Đăng nhập bằng Google để bình chọn" button calling `signInWithGoogle("/vote")`.
   - Else if `!status.isEligible` → "Tài khoản của bạn không có trong danh sách bình chọn."
   - Else if `status.hasVoted` → "Bạn đã bình chọn. Cảm ơn!" (anonymity: never show their choice).
   - Else → passcode step: input + "Vào bình chọn" → `verifyMvpPasscode`; on success show two candidate grids (male, female) with single-select each (using `PlayerAvatar`), then "Gửi bình chọn" → `castMvpVote(passcode, maleId, femaleId)`; on success show the thank-you state. Every button shows pending state.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { castMvpVote, verifyMvpPasscode } from "@/lib/supabase/mvpClient";
import type { IMvpCandidate, IMvpStatus } from "@/lib/tournament/mvp";

export function VoteFlow({
  status, male, female,
}: { status: IMvpStatus; male: IMvpCandidate[]; female: IMvpCandidate[] }) {
  const { user, loading, signInWithGoogle } = useRefereeAuth();
  const [phase, setPhase] = useState<"passcode" | "pick" | "done">("passcode");
  const [passcode, setPasscode] = useState("");
  const [maleId, setMaleId] = useState<string | null>(null);
  const [femaleId, setFemaleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status.status === "idle") return <p>Chưa có đợt bình chọn nào.</p>;
  if (status.status === "closed")
    return <p>Bình chọn đã kết thúc. <Link href="/">Xem kết quả</Link>.</p>;

  if (loading) return <p>Đang tải…</p>;
  if (!user)
    return (
      <button onClick={() => signInWithGoogle("/vote")}
        style={{ padding: "12px 20px", borderRadius: 10, background: "var(--color-primary)", color: "#fff", border: "none" }}>
        Đăng nhập bằng Google để bình chọn
      </button>
    );
  if (!status.isEligible) return <p>Tài khoản của bạn không có trong danh sách bình chọn.</p>;
  if (status.hasVoted || phase === "done") return <p>Bạn đã bình chọn. Cảm ơn! 🏸</p>;

  async function enter() {
    setBusy(true); setMsg(null);
    try {
      const ok = await verifyMvpPasscode(passcode.trim());
      if (!ok) { setMsg("Mã không đúng hoặc đã hết thời gian."); return; }
      setPhase("pick");
    } catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!maleId || !femaleId) { setMsg("Hãy chọn 1 nam và 1 nữ."); return; }
    setBusy(true); setMsg(null);
    try { await castMvpVote(passcode.trim(), maleId, femaleId); setPhase("done"); }
    catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  if (phase === "passcode")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>Nhập mã bình chọn</label>
        <input value={passcode} onChange={(e) => setPasscode(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
        <button disabled={busy || passcode.trim() === ""} onClick={enter}
          style={{ padding: "10px 16px", borderRadius: 10, background: "var(--color-primary)", color: "#fff", border: "none" }}>
          {busy ? "Đang kiểm tra…" : "Vào bình chọn"}
        </button>
        {msg && <p>{msg}</p>}
      </div>
    );

  const Grid = ({ list, sel, onSel, title }: {
    list: IMvpCandidate[]; sel: string | null; onSel: (id: string) => void; title: string;
  }) => (
    <div>
      <h3 style={{ fontFamily: "var(--font-bricolage)" }}>{title}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 12 }}>
        {list.map((c) => (
          <button key={c.id} onClick={() => onSel(c.id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 8,
              borderRadius: 12, border: sel === c.id ? "2px solid var(--color-primary)" : "1px solid #eee",
              background: sel === c.id ? "var(--color-cream)" : "#fff", cursor: "pointer" }}>
            <PlayerAvatar name={c.name} avatarKey={c.avatarKey} avatarUrl={c.avatarUrl} />
            <span style={{ fontSize: 13 }}>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Grid list={male} sel={maleId} onSel={setMaleId} title="MVP Nam" />
      <Grid list={female} sel={femaleId} onSel={setFemaleId} title="MVP Nữ" />
      <button disabled={busy || !maleId || !femaleId} onClick={submit}
        style={{ padding: "12px 20px", borderRadius: 10, background: "var(--color-primary)", color: "#fff", border: "none" }}>
        {busy ? "Đang gửi…" : "Gửi bình chọn"}
      </button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
```
(Match the real `useRefereeAuth` hook name/exports and `PlayerAvatar` prop names against their source files.)

- [ ] **Step 4: Verify build + manual walkthrough**

Run: `npm run build`
Expected: succeeds. Manual, with a vote open: visiting `/vote` signed-out prompts Google login; signed in as an allow-listed email, entering the correct passcode reveals the two grids; submitting one male + one female shows the thank-you state and blocks a second submission; a non-allow-listed account sees the ineligible message.

- [ ] **Step 5: Commit**

```bash
git add app/vote
git commit -m "feat(mvp): add public MVP voting flow with Google login and passcode gate"
```

---

## Task 8: Landing-page MVP prize + winners section

**Files:**
- Create: `app/MvpPrizeSection.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getMvpStatus` + `getMvpResults` (Task 4); `isResultsVisible` (Task 3); `PlayerAvatar`.
- Produces: an always-visible prize blurb that reveals the two winners once the vote is closed.

- [ ] **Step 1: The section component**

Create `app/MvpPrizeSection.tsx` (server component):

```tsx
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getMvpResults, getMvpStatus } from "@/lib/supabase/mvp";
import { isResultsVisible, type IMvpCandidate } from "@/lib/tournament/mvp";

export async function MvpPrizeSection() {
  const status = await getMvpStatus();
  const results = isResultsVisible(status.status) ? await getMvpResults() : null;

  const Winner = ({ title, winners }: { title: string; winners: IMvpCandidate[] }) => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ fontFamily: "var(--font-bricolage)" }}>{title}</h3>
      {winners.length === 0 ? (
        <p style={{ color: "#6b6b6b" }}>Chưa có kết quả</p>
      ) : (
        winners.map((c) => (
          <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <PlayerAvatar name={c.name} avatarKey={c.avatarKey} avatarUrl={c.avatarUrl} />
            <strong>{c.name}</strong>
          </div>
        ))
      )}
    </div>
  );

  return (
    <section style={{ padding: 24, background: "var(--color-cream)", borderRadius: 16, textAlign: "center" }}>
      <h2 style={{ fontFamily: "var(--font-bricolage)", color: "var(--color-primary)" }}>
        Giải MVP 🏸
      </h2>
      <p>
        Cầu thủ xuất sắc nhất (1 nam &amp; 1 nữ) do 16 vận động viên bình chọn.
        Phần thưởng: <strong>áo thể thao</strong>.
      </p>
      {results ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 16 }}>
          <Winner title="MVP Nam" winners={results.male.winners} />
          <Winner title="MVP Nữ" winners={results.female.winners} />
        </div>
      ) : status.status === "open" ? (
        <p style={{ marginTop: 12 }}>Đang diễn ra bình chọn…</p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the landing page**

In `app/page.tsx`, add a new `<Suspense>` boundary (after the rewards podium section, matching the existing pattern) wrapping `<MvpPrizeSection/>` with a shape-matching fallback:

```tsx
<Suspense fallback={<div style={{ height: 220 }} />}>
  <MvpPrizeSection />
</Suspense>
```
Import `MvpPrizeSection` from `./MvpPrizeSection`. Do not add any `await` to `page.tsx` itself.

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build`
Expected: succeeds. Manual: on `/` the prize blurb always renders; while a vote is open it shows "Đang diễn ra bình chọn…"; after the referee closes the vote, the two winners appear with avatars. Confirm results do **not** appear while the vote is still open (results RPC returns empty).

- [ ] **Step 4: Full suite + commit**

Run: `npm run test && npm run lint && npm run build`
Expected: all pass.

```bash
git add app/MvpPrizeSection.tsx app/page.tsx
git commit -m "feat(mvp): add MVP prize and winners section to landing page"
```

---

## Self-Review

**1. Spec coverage:**
- "Landing page prize for 1 male + 1 female MVP, voted by 16 players, prize = sport shirt" → Task 8 (blurb copy names the sport shirt + 16 voters) + Task 1 (gender) ✓
- "Referee starts a voting session, adds time, sees number already voted, creates a passcode" → Task 2 (`open_mvp_vote(passcode, minutes)`) + Task 6 (control panel: passcode + minutes inputs, live `X/total` turnout via `useMvpTurnout`, countdown) ✓
- "Players log in with Google and enter passcode to enter voting" → Task 7 (`signInWithGoogle` + passcode step via `verify_mvp_passcode`) ✓
- "Voting is anonymous" → Task 1/2 (receipts vs. ballots split; `cast_mvp_vote` writes both, ballots hold no voter ref; ballots table has no SELECT policy) ✓
- "When time's up or referee ends, everyone sees results" → Task 2 (`get_mvp_results` gated on closed-or-past-deadline; `get_mvp_status` collapses past-deadline → closed) + Task 8 (winners on landing) + Task 6 (manual close) ✓
- Eligibility to exactly 16 → Task 1/2 allow-list + `is_mvp_voter`; Task 6 allow-list editor with `X/16` ✓

**2. Placeholder scan:** SQL, pure logic, data layer, and all four component files contain real code. Remaining "match the existing X" notes point at concrete files (`PlayerAvatar`, `Skeleton`, `Countdown`, `AdminSectionSkeleton`, `RefereeAuthContext`, the `patch`/`busyId` names in `PlayersEditor`) whose exact prop/handler names the implementer must confirm against source — these are verification instructions, not missing logic. No "TODO"/"add validation"/"similar to Task N" placeholders.

**3. Type consistency:** `IMvpStatus`, `IMvpCandidate`, `IMvpResults`, `IMvpGenderResult`, `TGender`, `TMvpStatus` are defined once in Task 3 and consumed with the same field names in Tasks 4/6/7/8. RPC names match between Task 2 (SQL), Task 4 (`database.types.ts` + wrappers), and callers. `get_mvp_status` JSON keys (`voted_count`, `total_eligible`, `is_eligible`, `has_voted`) are mapped to camelCase in exactly one place (`getMvpStatus`) and the raw keys are reused consistently in `useMvpTurnout`.

**Known follow-ups (out of scope, flag to user):**
- `reset_tournament()` does not clear the MVP vote. If organizers expect a full reset to wipe MVP state too, add `perform reset_mvp_vote()`-equivalent SQL to it in a later change.
- Component-level RTL tests for `VoteFlow`/`MvpControlPanel` are not included (only pure logic is unit-tested, matching the current repo where the real tree has no component tests). Add them if the team wants UI regression coverage.
- Anonymity is app-level (per your decision): a database super-admin could in principle correlate a lone receipt with a lone ballot by insert order. `mvp_ballots` deliberately stores no timestamp to blunt this. Batch/real anonymity (e.g. blind tokens) is a larger effort if ever required.
