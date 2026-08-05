# MVP Player Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a referee run a single time-boxed MVP vote per tournament in which 16 allow-listed players sign in with Google and anonymously each pick one male and one female MVP, with live turnout for the referee and final winners shown to everyone (and advertised on the landing page as a sport-shirt prize).

**Eligibility (no passcode):** Anyone can sign in with Google, but only allow-listed emails can cast a vote — enforced server-side in `cast_mvp_vote()` via `is_mvp_voter()`. This replaces the passcode entirely: the allow-list is a stronger, per-identity gate than a shared code. The admin builds the allow-list by **picking from everyone who has signed in** (a `SECURITY DEFINER` `list_system_users()` reads `auth.users`, organizer-only), not by typing emails — so players sign in first, then the referee checks off the ~16 voters.

**Architecture:** Add a `gender` column to `players` (every player is a candidate) plus four new tables — `mvp_vote` (singleton state: deadline, status), `mvp_voter_allowlist` (16 eligible emails), `mvp_receipts` (one row per voter — proves participation, no choice) and `mvp_ballots` (choices — gender + candidate, **no voter reference, no timestamp**). A single `SECURITY DEFINER` RPC `cast_mvp_vote()` writes one receipt + two ballots in one transaction. Reads that gate results-by-time go through `SECURITY DEFINER` RPCs (`get_mvp_status`, `get_mvp_results`). Referee turnout is live via Supabase Realtime on `mvp_receipts`. UI follows the existing organizer-gated client-mutation pattern and the landing-page `<Suspense>` streaming pattern.

**Anonymity is access-control level, not information-theoretic** (be explicit in copy and threat model): no Data-API role (`anon`/`authenticated`) — and no application code path — can join a voter to their choice, because `mvp_ballots` holds no voter reference, has no SELECT grant and no RLS policy, and is read only via `get_mvp_results()`. It is **not** anonymous against a raw-database actor (`service_role`, `postgres`): ballots commit in stable pairs, so physical row order (`ctid`) still correlates with `mvp_receipts` insertion order. To blunt even that, `mvp_receipts` stores **no `created_at`** (turnout needs only `COUNT(*)`), removing the timestamp key that would make the correlation trivial. This is the right posture for a club prize; do not describe it as unbreakable.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 + shadcn/ui (`components/ui/*`, `radix-ui`, `motion/react`, `lucide-react`, CSS-var brand tokens) · Supabase (`@supabase/ssr`, Postgres + RLS + Realtime + Google OAuth) · Vitest 4 + Testing Library.

## Global Constraints

- **All user-facing copy is Vietnamese.** Match the tone of existing screens.
- **RLS-first / default-deny.** Every new table has explicit RLS. No table is public-writable; every write goes through an organizer-gated policy or a `SECURITY DEFINER` RPC. `mvp_ballots` has **no** SELECT policy for anyone — it is read only via `get_mvp_results()`.
- **Grants are required in addition to RLS.** This project does not auto-expose new `public` tables to `anon`/`authenticated` (see `init_schema.sql`); RLS gates rows, `GRANT` gates table access, and every client-touched table needs both. `mvp_ballots` is deliberately granted to no Data-API role. Missing grants fail loudly at runtime but pass `SECURITY DEFINER` psql tests — verify grants explicitly.
- **Anonymity is access-control level, not information-theoretic.** Copy and threat-model language must not claim ballots are unlinkable against a raw-DB actor (`service_role`/superuser) — only against Data-API roles and app code. `mvp_receipts` stores no timestamp to blunt physical-order correlation.
- **Migrations are the only way to change schema.** Files in `supabase/migrations/`, naming `YYYYMMDDHHMMSS_description.sql`. Also add a matching cloud snapshot `supabase/cloud-phase7-mvp-voting.sql` (mirrors the migration verbatim) — this repo keeps parallel `cloud-*.sql` snapshots applied to the cloud project.
- **`SECURITY DEFINER` function template** (copy exactly): `language sql|plpgsql security definer set search_path = public [stable]`, then `revoke all on function ... from public;` and `grant execute on function ... to anon|authenticated;`. Organizer-write RPCs start with `if not public.is_organizer() then raise exception 'not authorized' using errcode = '42501'; end if;`.
- **Types:** `TEXT` not `VARCHAR`; `uuid` PKs via `gen_random_uuid()`; soft-delete via `deleted_at timestamptz` where a domain record can be removed. Singleton tables use `id boolean primary key default true check (id)`.
- **snake_case ↔ camelCase conversion happens only in the data layer** (`lib/supabase/*.ts` mappers). Components consume camelCase interfaces; raw table writes use snake_case inline.
- **Streaming:** any new landing-page section is wrapped in its own `<Suspense>` with a shape-matching skeleton; `page.tsx` never `await`s data before returning markup.
- **UI stack is shadcn/ui (post-#12), not inline styles.** This branch is rebased on `origin/main` which merged the shadcn migration. Use the primitives in `components/ui/*` via `className` + `cn()` + Tailwind utilities and the brand tokens — **do not** write ad-hoc `style={{}}` objects (except for genuinely dynamic pixel values, as `PlayerAvatar`/`Skeleton` do). Key facts: primitives use the unified `radix-ui` package and `motion/react` (not framer-motion); icons are `lucide-react`; `Button` has on-brand variants `success` (teal), `danger`/`dangerOutline` (maroon) plus `default|outline|secondary|ghost|link`; **there is no `Checkbox` primitive** — compose toggles from `Button`. Confirmations use `AlertDialog` (see `LifecyclePanel`). Wrap landing sections in `<Reveal>` from `components/motion`. Brand utility classes: `bg-primary text-primary-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `text-gold`, `text-cream`, `text-text-soft/-muted`. Headings use `font-[family-name:var(--font-bricolage)]`, mono labels `font-[family-name:var(--font-jetbrains)]`. Light-mode only.
- **Mutations show pending state**; buttons disable while in flight (`busy` flag + `<Loader2 className="animate-spin" />` inside the `Button`, mirroring `RewardsEditor`/`LifecyclePanel`). Detect RLS denial via the zero-row-returned convention (`if (!data || data.length === 0) …`).
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
- `app/vote/VoteFlow.tsx` — `"use client"` voting flow (login → pick → submit → result).
- `app/vote/loading.tsx` — route-transition skeleton.
- `app/admin/mvp/page.tsx` — organizer MVP control route (server shell + Suspense).
- `app/admin/mvp/MvpControlPanel.tsx` — `"use client"` start/close/reset + live turnout.
- `app/admin/mvp/MvpVoterAllowlistEditor.tsx` — `"use client"` pick voters from all signed-in users (checkbox per user).
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

// A user who has signed in at least once (sourced from auth.users, organizer-only).
export interface ISystemUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}
```

RPC signatures (defined in Task 2):

- `is_mvp_voter() → boolean`
- `list_system_users() → setof (id uuid, email text, name text, avatar_url text)` (organizer — everyone who has signed in)
- `get_mvp_status() → json` (keys: `status, deadline, voted_count, total_eligible, is_eligible, has_voted`)
- `get_mvp_results() → setof (gender text, candidate_id uuid, votes bigint)` (empty unless effectively closed)
- `cast_mvp_vote(p_male_id uuid, p_female_id uuid) → void`
- `open_mvp_vote(p_minutes int) → void` (organizer)
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

-- Composite-unique so mvp_ballots can reference (id, gender) — see table 5. This makes a
-- ballot's stored gender referentially match the candidate's gender, and blocks re-gendering
-- or hard-deleting a candidate while any ballot points at them.
alter table public.players
  add constraint players_id_gender_key unique (id, gender);

-- 2. Singleton vote state (mirrors public.tournament).
create table if not exists public.mvp_vote (
  id boolean primary key default true check (id),
  status text not null default 'idle' check (status in ('idle', 'open', 'closed')),
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
--    Deliberately NO created_at (deviates from the house audit-column convention): turnout
--    needs only COUNT(*), and omitting the timestamp removes the key that would let a
--    raw-DB actor correlate receipts with ballots by time. Do not re-add it.
create table if not exists public.mvp_receipts (
  email text primary key
);

-- 5. Ballots: the choices. NO voter reference and NO timestamp (anonymity: see header).
--    Composite FK (candidate_id, gender) -> players(id, gender) forces ballot.gender to equal
--    the candidate's gender and blocks re-gendering / hard-deleting a referenced candidate.
--    !! INVARIANT: this table must NEVER receive an INSERT/SELECT grant or an RLS policy. !!
--    Writes happen ONLY through cast_mvp_vote() (SECURITY DEFINER); reads ONLY through
--    get_mvp_results() (SECURITY DEFINER). All ballot integrity ("2 per voter, 1 male + 1
--    female") rests on this being the sole writer — a grant or policy here silently destroys it.
create table if not exists public.mvp_ballots (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('male', 'female')),
  candidate_id uuid not null,
  foreign key (candidate_id, gender) references public.players (id, gender)
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

-- mvp_vote: organizer may SELECT (manage). Anon/voters read state via get_mvp_status() RPC.
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

-- Table grants. This project does NOT auto-expose new public tables to the Data API roles
-- (see init_schema.sql) — RLS gates rows, grants gate table access; both are required.
-- Without these, the allow-list editor and realtime turnout fail with "permission denied"
-- even though the SECURITY DEFINER RPCs keep working (which hides the gap in psql tests).
grant select, insert, delete on public.mvp_voter_allowlist to authenticated;  -- organizer picker
grant select on public.mvp_receipts to authenticated;                          -- turnout + realtime
grant select on public.mvp_vote to authenticated;                              -- organizer manage
-- mvp_ballots: intentionally granted to NO Data API role (see INVARIANT comment on the table).

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

-- allow-list is granted to the Data API role (else the editor 500s)
select string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
  where grantee='authenticated' and table_name='mvp_voter_allowlist'; -- DELETE,INSERT,SELECT

-- ballots exposed to NO Data API role
select count(*) from information_schema.role_table_grants
  where grantee in ('anon','authenticated') and table_name='mvp_ballots';  -- 0
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
-- Emails are stored lower-cased (see addMvpVoter + cast_mvp_vote) and compared lower-cased,
-- so a casing/whitespace mismatch can never silently disqualify an eligible voter.
create or replace function public.is_mvp_voter()
  returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mvp_voter_allowlist a
    where a.email = lower(auth.jwt() ->> 'email')
  );
$$;
revoke all on function public.is_mvp_voter() from public;
grant execute on function public.is_mvp_voter() to anon, authenticated;

-- Organizer-only: list everyone who has signed in (safe subset of auth.users), so the
-- admin can pick voters instead of typing emails. Returns nothing for non-organizers.
create or replace function public.list_system_users()
  returns table (id uuid, email text, name text, avatar_url text)
  language sql security definer set search_path = public stable
as $$
  select u.id,
         u.email,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  from auth.users u
  where public.is_organizer() and u.email is not null
  order by coalesce(u.raw_user_meta_data ->> 'full_name', u.email);
$$;
revoke all on function public.list_system_users() from public;
grant execute on function public.list_system_users() to authenticated;

-- Public status snapshot. Collapses past-deadline -> 'closed'.
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
        select 1 from public.mvp_receipts r where r.email = lower(auth.jwt() ->> 'email'))
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

-- Cast a ballot: 1 receipt + 2 ballots, atomic. Enforces eligibility, window, no-double.
create or replace function public.cast_mvp_vote(
  p_male_id uuid, p_female_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if v_email is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;
  if not public.is_mvp_voter() then
    raise exception 'not eligible to vote' using errcode = '42501';
  end if;
  if not public.is_mvp_open() then
    raise exception 'voting is not open' using errcode = '42501';
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

  -- Receipt PK on email is the real double-vote guard; the exists() check above is a fast path
  -- that loses a concurrent race. Translate the unique violation into the friendly error so two
  -- simultaneous submits from the same account both get "already voted", never a raw 23505.
  -- Atomicity: if this raises, the whole function rolls back — no orphan ballots.
  begin
    insert into public.mvp_receipts (email) values (v_email);
  exception when unique_violation then
    raise exception 'already voted' using errcode = '42501';
  end;
  insert into public.mvp_ballots (gender, candidate_id)
    values ('male', p_male_id), ('female', p_female_id);
end;
$$;
revoke all on function public.cast_mvp_vote(uuid, uuid) from public;
grant execute on function public.cast_mvp_vote(uuid, uuid) to authenticated;

-- Organizer: open a fresh vote. Wipes prior receipts/ballots so re-runs start clean.
create or replace function public.open_mvp_vote(p_minutes int)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
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
    set status = 'open',
        opened_at = now(), deadline = now() + make_interval(mins => p_minutes),
        updated_at = now()
    where id = true;
end;
$$;
revoke all on function public.open_mvp_vote(int) from public;
grant execute on function public.open_mvp_vote(int) to authenticated;

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
    set status = 'idle', opened_at = null, deadline = null,
        updated_at = now()
    where id = true;
end;
$$;
revoke all on function public.reset_mvp_vote() from public;
grant execute on function public.reset_mvp_vote() to authenticated;

-- Couple the tournament reset to the MVP reset: redefine reset_tournament() to also wipe MVP
-- receipts/ballots and return the vote to 'idle'. Body below is the CURRENT reset_tournament()
-- from 20260805000000_swiss_generation.sql, verbatim, with `perform public.reset_mvp_vote()`
-- appended. Must come AFTER reset_mvp_vote is defined (above). If reset_tournament() changes in
-- a later migration, that migration must re-append this call.
create or replace function public.reset_tournament()
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- drop generated rounds; zero the round-1 scores; back to setup
  delete from public.matches where round_n >= 2;
  update public.matches set score_a = 0, score_b = 0, state = 'next' where round_n = 1 and deleted_at is null;
  update public.tournament set status = 'setup', updated_at = now() where id = true;
  -- also clear the MVP vote (receipts, ballots, back to idle)
  perform public.reset_mvp_vote();
end;
$$;
revoke all on function public.reset_tournament() from public;
grant execute on function public.reset_tournament() to authenticated;
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

-- organizer can enumerate signed-in users; a non-organizer JWT gets 0 rows
select count(*) from public.list_system_users();                  -- >=1 as organizer, 0 otherwise

-- open as organizer (run with a JWT whose email is in organizers; via app or set request.jwt.claims)
select public.open_mvp_vote(60);
select status, (deadline > now()) from public.mvp_vote;           -- open, t

-- results still hidden while open
select count(*) from public.get_mvp_results();                    -- 0

-- (as voter@example.com) cast a vote, then double-vote is blocked
select public.cast_mvp_vote('<PLAYER_M>', '<PLAYER_F>');          -- ok
select public.cast_mvp_vote('<PLAYER_M>', '<PLAYER_F>');          -- ERROR: already voted
select count(*) from public.mvp_receipts;                         -- 1
select count(*) from public.mvp_ballots;                          -- 2

-- close -> results visible
select public.close_mvp_vote();
select gender, votes from public.get_mvp_results() order by gender; -- female:1, male:1

-- reset_tournament() also wipes MVP state (organizer), but keeps the allow-list
select public.reset_tournament();
select status from public.mvp_vote;                               -- idle
select count(*) from public.mvp_receipts;                         -- 0
select count(*) from public.mvp_ballots;                          -- 0
select count(*) from public.mvp_voter_allowlist;                  -- unchanged (allow-list kept)
```
Expected: each assertion matches the comment; `cast_mvp_vote` from a non-allow-listed email (or while the vote is not open) raises `42501`.

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

export interface ISystemUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
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
- Produces: `getMvpCandidates`, `getMvpStatus`, `getMvpResults` (server); `castMvpVote`, `openMvpVote`, `closeMvpVote`, `resetMvpVote`, `listSystemUsers`, `getMvpVoterAllowlist`, `addMvpVoter`, `removeMvpVoter` (client/RPC).

- [ ] **Step 1: Extend `database.types.ts`**

In `lib/supabase/database.types.ts`, add to the `public.Tables` block (matching the existing generated shape) entries for `mvp_vote`, `mvp_voter_allowlist`, `mvp_receipts`, `mvp_ballots`, add `gender: string | null` to `players` Row/Insert/Update, and add to the `Functions` block: `is_mvp_voter`, `is_mvp_open`, `list_system_users`, `get_mvp_status`, `get_mvp_results`, `cast_mvp_vote`, `open_mvp_vote`, `close_mvp_vote`, `reset_mvp_vote` with argument/return types mirroring Task 2. Follow the exact style of the existing `is_organizer` / `start_tournament` declarations already in the file. If the Supabase CLI is available, prefer `supabase gen types typescript --local > lib/supabase/database.types.ts` and then re-check the file compiles.

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

// Resolve candidates by id ignoring deleted_at — used so a candidate soft-deleted AFTER voting
// still appears in results (their votes must not silently vanish and flip the winner).
async function getPlayersByIds(ids: string[]): Promise<IMvpCandidate[]> {
  if (ids.length === 0) return [];
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, name, tier, gender, avatar_key, avatar_url")
    .in("id", ids)
    .not("gender", "is", null);
  if (error) throw new Error(`Failed to resolve candidates: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id, name: p.name, gender: p.gender as TGender, tier: p.tier as TTier,
    avatarKey: p.avatar_key, avatarUrl: p.avatar_url,
  }));
}

// Returns male/female results with winners once the vote is closed; the RPC returns no rows
// while idle/open, which tallies to zero winners (a "no winner yet" render).
export async function getMvpResults(): Promise<IMvpResults | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_mvp_results");
  if (error) throw new Error(`Failed to load MVP results: ${error.message}`);
  const rows = (data ?? []) as { gender: TGender; candidate_id: string; votes: number }[];

  // Union of current candidates (so zero-vote ones still show) + any balloted candidate that
  // is no longer in the live candidate set (soft-deleted), so no votes are dropped.
  const current = await getMvpCandidates();
  const missing = Array.from(new Set(rows.map((r) => r.candidate_id)))
    .filter((id) => !current.some((c) => c.id === id));
  const candidates = [...current, ...(await getPlayersByIds(missing))];

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

In `app/admin/players/PlayersEditor.tsx`, next to the existing **tier** `Select` for each player row (which already uses `onValueChange` + `patch(p.id, { tier })` + `disabled={!editable}`), add a **gender** `Select` following that exact pattern. Radix `Select` items cannot have an empty-string value, so use the sentinel `"none"` for "not chosen" and translate it to `null` on write. Import `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select` and `Label` from `@/components/ui/label` (both already used elsewhere in the file/app).

```tsx
<div className="flex flex-col gap-1">
  <Label className="text-xs text-muted-foreground">Giới tính</Label>
  <Select
    value={p.gender ?? "none"}
    disabled={!editable}
    onValueChange={(v) => void patch(p.id, { gender: v === "none" ? null : (v as "male" | "female") })}
  >
    <SelectTrigger className="h-10 min-w-[140px]"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="none">Chưa chọn</SelectItem>
      <SelectItem value="male">Nam</SelectItem>
      <SelectItem value="female">Nữ</SelectItem>
    </SelectContent>
  </Select>
</div>
```
(Match the real per-row variable name and `patch` helper actually used in the file — the tier `Select` right above is the template.)

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
- Consumes: `getMvpStatus` (Task 4, server), `openMvpVote`/`closeMvpVote`/`resetMvpVote`/`listSystemUsers`/`getMvpVoterAllowlist`/`addMvpVoter`/`removeMvpVoter` (Task 4, client), shadcn `Button`/`Card`/`Input`/`Label`/`Avatar`/`AlertDialog`, lucide icons, the `AdminSectionSkeleton title=…` fallback, and `<Countdown target={isoString} />` (note: `Countdown` takes an ISO **string**, not a `Date`).
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
import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Countdown } from "@/components/Countdown";
import { useMvpTurnout } from "@/lib/supabase/useMvpTurnout";
import { closeMvpVote, openMvpVote, resetMvpVote } from "@/lib/supabase/mvpClient";
import type { IMvpStatus } from "@/lib/tournament/mvp";

export function MvpControlPanel({ initial }: { initial: IMvpStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(10);
  const { votedCount, totalEligible } = useMvpTurnout(initial.votedCount, initial.totalEligible);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { await action(); router.refresh(); }
    catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  if (initial.status === "open") {
    return (
      <Card className="gap-4 p-6">
        <h2 className="font-[family-name:var(--font-bricolage)] text-xl">Đang bình chọn</h2>
        <p className="font-[family-name:var(--font-jetbrains)] text-3xl font-bold text-primary">
          {votedCount} / {totalEligible}{" "}
          <span className="text-base font-normal text-muted-foreground">đã bình chọn</span>
        </p>
        {initial.deadline && <Countdown target={initial.deadline} />}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="dangerOutline" disabled={busy} className="w-fit">
              {busy ? <Loader2 className="animate-spin" /> : <Square />} Kết thúc bình chọn
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kết thúc bình chọn?</AlertDialogTitle>
              <AlertDialogDescription>
                Kết quả sẽ hiển thị công khai ngay lập tức và không thể mở lại đợt này.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant="danger" onClick={() => void run(closeMvpVote)}>Kết thúc</Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </Card>
    );
  }

  if (initial.status === "closed") {
    return (
      <Card className="gap-4 p-6">
        <h2 className="font-[family-name:var(--font-bricolage)] text-xl">Bình chọn đã kết thúc</h2>
        <p className="text-muted-foreground">Kết quả đã hiển thị công khai trên trang chủ.</p>
        <Button variant="outline" disabled={busy} className="w-fit"
          onClick={() => void run(resetMvpVote)}>
          {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Đặt lại để bình chọn mới
        </Button>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </Card>
    );
  }

  // idle
  return (
    <Card className="gap-4 p-6">
      <h2 className="font-[family-name:var(--font-bricolage)] text-xl">Bắt đầu bình chọn MVP</h2>
      <p className="text-sm text-muted-foreground">
        Chỉ những người trong danh sách bên dưới mới có thể bình chọn.
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="mvp-minutes">Thời gian (phút)</Label>
        <Input id="mvp-minutes" type="number" min={1} value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))} className="h-10 w-32" />
      </div>
      <Button variant="success" disabled={busy || minutes < 1} className="w-fit"
        onClick={() => void run(() => openMvpVote(minutes))}>
        {busy ? <Loader2 className="animate-spin" /> : <Play />} Mở bình chọn
      </Button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </Card>
  );
}
```

- [ ] **Step 4: Voter picker (from all signed-in users)**

Create `app/admin/mvp/MvpVoterAllowlistEditor.tsx` (`"use client"`): in one effect, load `listSystemUsers()` (everyone who has signed in) and `getMvpVoterAllowlist()` (current voter emails) in parallel; render every user as a `Card` row with a shadcn `Avatar` + name + email and a **toggle `Button`** reflecting whether they are on the allow-list (there is no `Checkbox` primitive — the button is `variant="success"` with a `Check` icon when selected, `variant="outline"` with a `Plus` icon otherwise). Toggling **on** calls `addMvpVoter(email)`, **off** calls `removeMvpVoter(email)`, updating a local `Set` of selected (lower-cased) emails. Handle `addMvpVoter` returning `"denied"` by showing "Không có quyền quản trị." Show a `X / 16` selected hint and a note that users appear only after signing in once. Disable all toggles when `status === "open"` (pass `disabled` prop). Use `ISystemUser`'s `avatarUrl` on `AvatarImage` (not `PlayerAvatar`, which needs an `IPlayer`).

```tsx
"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  addMvpVoter, getMvpVoterAllowlist, listSystemUsers, removeMvpVoter,
} from "@/lib/supabase/mvpClient";
import type { ISystemUser } from "@/lib/tournament/mvp";

export function MvpVoterAllowlistEditor({ disabled }: { disabled: boolean }) {
  const [users, setUsers] = useState<ISystemUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [list, emails] = await Promise.all([listSystemUsers(), getMvpVoterAllowlist()]);
        setUsers(list);
        setSelected(new Set(emails));
      } catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    })();
  }, []);

  async function toggle(email: string, on: boolean) {
    setBusyEmail(email); setMsg(null);
    try {
      if (on) {
        const res = await addMvpVoter(email);
        if (res === "denied") { setMsg("Không có quyền quản trị."); return; }
        setSelected((prev) => new Set(prev).add(email));
      } else {
        await removeMvpVoter(email);
        setSelected((prev) => { const n = new Set(prev); n.delete(email); return n; });
      }
    } catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusyEmail(null); }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-bricolage)] text-lg">Người bình chọn</h3>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-muted-foreground">
          {selected.size}/16
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Người dùng chỉ hiện ở đây sau khi đã đăng nhập ít nhất một lần.
      </p>
      <ul className="flex flex-col gap-2">
        {users.map((u) => {
          const email = u.email.toLowerCase();      // allow-list stores lower-cased emails
          const on = selected.has(email);
          const pending = busyEmail === email;
          return (
            <li key={u.id}>
              <Card className="flex-row items-center gap-3 rounded-[14px] p-3">
                <Avatar>
                  {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name ?? email} />}
                  <AvatarFallback>{(u.name ?? email).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-sm">{u.name ?? "(chưa có tên)"}</strong>
                  <span className="truncate font-[family-name:var(--font-jetbrains)] text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </div>
                <Button size="sm" variant={on ? "success" : "outline"}
                  disabled={disabled || pending} onClick={() => void toggle(email, !on)}>
                  {pending ? <Loader2 className="animate-spin" /> : on ? <Check /> : <Plus />}
                  {on ? "Đã chọn" : "Chọn"}
                </Button>
              </Card>
            </li>
          );
        })}
        {users.length === 0 && (
          <li className="text-sm text-muted-foreground">Chưa có người dùng nào đăng nhập.</li>
        )}
      </ul>
      {disabled && <p className="text-xs text-muted-foreground">Không thể sửa khi đang bình chọn.</p>}
      {msg && <p className="text-sm text-destructive">{msg}</p>}
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
    <div className="flex flex-col gap-6">
      <MvpControlPanel initial={status} />
      <MvpVoterAllowlistEditor disabled={status.status === "open"} />
    </div>
  );
}

export default function MvpAdminPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Bình chọn MVP" />}>
      <MvpAdminData />
    </Suspense>
  );
}
```
(Confirm `AdminSectionSkeleton`'s import path and its `title` prop against the existing `app/admin/referee/page.tsx` / `app/admin/players/page.tsx` shells and match them.)

- [ ] **Step 6: Verify build + manual walkthrough**

Run: `npm run build`
Expected: succeeds. Manual: as an organizer, `/admin/mvp` shows the idle start form + a voter picker listing every signed-in user; checking a user updates `X/16` and persists (reload confirms); opening a vote (with genders set on players) flips to the live turnout view with countdown; casting a vote from another browser increments turnout live; "Kết thúc" flips to closed. Confirm a user who has never signed in does not appear in the picker.

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
- Consumes: `getMvpStatus` + `getMvpCandidates` (Task 4, server); `castMvpVote` (Task 4, client); `RefereeAuthContext` (`user`, `loading`, `signInWithGoogle(next)`); `groupCandidatesByGender`; shadcn `Button`, `PlayerAvatar` (needs `player: IPlayer`), `GoogleIcon`, `cn`, lucide `Loader2`.
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
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-bricolage)] text-2xl">Bình chọn MVP</h1>
      <Suspense fallback={<Skeleton height="320px" borderRadius="16px" />}>
        <VoteData />
      </Suspense>
    </main>
  );
}
```
(`Skeleton` signature is `Skeleton({ width, height, borderRadius, className, style })` — pass `height`/`borderRadius` strings, not a `style` object.)

- [ ] **Step 3: The client flow**

Create `app/vote/VoteFlow.tsx` (`"use client"`). It is a small state machine over the initial `status`:

1. `status.status === "idle"` → "Chưa có đợt bình chọn nào." (nothing to do).
2. `status.status === "closed"` → "Bình chọn đã kết thúc. Xem kết quả trên trang chủ." + link to `/`.
3. `status.status === "open"`:
   - If `!user` (from `useRefereeAuth`) → "Đăng nhập bằng Google để bình chọn" button calling `signInWithGoogle("/vote")`.
   - Else if `!status.isEligible` → "Tài khoản của bạn không có trong danh sách bình chọn."
   - Else if `status.hasVoted` → "Bạn đã bình chọn. Cảm ơn!" (anonymity: never show their choice).
   - Else → show two candidate grids (male, female) with single-select each (using `PlayerAvatar`), then "Gửi bình chọn" → `castMvpVote(maleId, femaleId)`; on success show the thank-you state. Every button shows pending state.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/brand/GoogleIcon";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { castMvpVote } from "@/lib/supabase/mvpClient";
import { cn } from "@/lib/utils";
import type { IMvpCandidate, IMvpStatus } from "@/lib/tournament/mvp";

export function VoteFlow({
  status, male, female,
}: { status: IMvpStatus; male: IMvpCandidate[]; female: IMvpCandidate[] }) {
  const { user, loading, signInWithGoogle } = useRefereeAuth();
  const [phase, setPhase] = useState<"pick" | "done">("pick");
  const [maleId, setMaleId] = useState<string | null>(null);
  const [femaleId, setFemaleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status.status === "idle")
    return <p className="text-muted-foreground">Chưa có đợt bình chọn nào.</p>;
  if (status.status === "closed")
    return (
      <p className="text-muted-foreground">
        Bình chọn đã kết thúc. <Link href="/" className="text-primary underline">Xem kết quả</Link>.
      </p>
    );

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!user)
    return (
      <Button variant="outline" className="w-fit gap-2" onClick={() => void signInWithGoogle("/vote")}>
        <GoogleIcon size={16} /> Đăng nhập bằng Google để bình chọn
      </Button>
    );
  if (!status.isEligible)
    return <p className="text-muted-foreground">Tài khoản của bạn không có trong danh sách bình chọn.</p>;
  if (status.hasVoted || phase === "done")
    return <p className="text-lg font-semibold text-primary">Bạn đã bình chọn. Cảm ơn! 🏸</p>;

  async function submit() {
    if (!maleId || !femaleId) { setMsg("Hãy chọn 1 nam và 1 nữ."); return; }
    if (busy) return;
    setBusy(true); setMsg(null);
    try { await castMvpVote(maleId, femaleId); setPhase("done"); }
    catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  const Grid = ({ list, sel, onSel, title }: {
    list: IMvpCandidate[]; sel: string | null; onSel: (id: string) => void; title: string;
  }) => (
    <div className="flex flex-col gap-3">
      <h3 className="font-[family-name:var(--font-bricolage)] text-lg">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
        {list.map((c) => (
          <button key={c.id} type="button" onClick={() => onSel(c.id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-2 transition-transform hover:-translate-y-0.5",
              sel === c.id ? "border-primary bg-cream ring-2 ring-primary" : "border-border bg-card",
            )}>
            <PlayerAvatar player={c} size={56} />
            <span className="text-center text-sm">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Grid list={male} sel={maleId} onSel={setMaleId} title="MVP Nam" />
      <Grid list={female} sel={femaleId} onSel={setFemaleId} title="MVP Nữ" />
      <Button variant="success" className="w-fit" disabled={busy || !maleId || !femaleId}
        onClick={() => void submit()}>
        {busy ? <Loader2 className="animate-spin" /> : null} Gửi bình chọn
      </Button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
```
(`PlayerAvatar` takes `player: IPlayer` + `size` — `IMvpCandidate` is structurally an `IPlayer` (id/name/tier/avatarKey/avatarUrl); if `IPlayer` has extra required fields, map explicitly. Confirm `GoogleIcon`'s path/props against `components/brand/GoogleIcon.tsx`.)

- [ ] **Step 4: Verify build + manual walkthrough**

Run: `npm run build`
Expected: succeeds. Manual, with a vote open: visiting `/vote` signed-out prompts Google login; signed in as an allow-listed email, the two candidate grids appear directly; submitting one male + one female shows the thank-you state and blocks a second submission; a non-allow-listed account sees the ineligible message.

- [ ] **Step 5: Commit**

```bash
git add app/vote
git commit -m "feat(mvp): add public MVP voting flow with Google login and allow-list gate"
```

---

## Task 8: Landing-page MVP prize + winners section

**Files:**
- Create: `app/MvpPrizeSection.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getMvpStatus` + `getMvpResults` (Task 4); `isResultsVisible` (Task 3); `PlayerAvatar` (needs `player: IPlayer`); shadcn `Card`; `Reveal` from `components/motion`.
- Produces: an always-visible prize blurb that reveals the two winners once the vote is closed.

- [ ] **Step 1: The section component**

Create `app/MvpPrizeSection.tsx` (server component):

```tsx
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Card } from "@/components/ui/card";
import { getMvpResults, getMvpStatus } from "@/lib/supabase/mvp";
import { isResultsVisible, type IMvpCandidate } from "@/lib/tournament/mvp";

export async function MvpPrizeSection() {
  const status = await getMvpStatus();
  const results = isResultsVisible(status.status) ? await getMvpResults() : null;

  const Winner = ({ title, winners }: { title: string; winners: IMvpCandidate[] }) => (
    <div className="flex flex-col items-center gap-2 text-center">
      <h3 className="font-[family-name:var(--font-bricolage)] text-lg">{title}</h3>
      {winners.length === 0 ? (
        <p className="text-muted-foreground">Chưa có kết quả</p>
      ) : (
        winners.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1.5">
            <PlayerAvatar player={c} size={72} />
            <strong>{c.name}</strong>
          </div>
        ))
      )}
    </div>
  );

  return (
    <Card className="items-center gap-3 border-none bg-cream p-6 text-center">
      <h2 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">Giải MVP 🏸</h2>
      <p className="text-text-soft">
        Cầu thủ xuất sắc nhất (1 nam &amp; 1 nữ) do 16 vận động viên bình chọn.
        Phần thưởng: <strong>áo thể thao</strong>.
      </p>
      {results ? (
        <div className="mt-4 grid w-full grid-cols-2 gap-6">
          <Winner title="MVP Nam" winners={results.male.winners} />
          <Winner title="MVP Nữ" winners={results.female.winners} />
        </div>
      ) : status.status === "open" ? (
        <p className="mt-2 text-text-soft">Đang diễn ra bình chọn…</p>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 2: Wire it into the landing page**

In `app/page.tsx`, add a new section after the rewards podium, matching the existing `<Reveal>` + `<Suspense>` pattern (the rewards section uses `<Reveal delay={0.2}>` around a heading + `<Suspense fallback={<div className="h-[260px]" />}>`):

```tsx
<Reveal delay={0.2}>
  <Suspense fallback={<div className="h-[220px]" />}>
    <MvpPrizeSection />
  </Suspense>
</Reveal>
```
Import `MvpPrizeSection` from `./MvpPrizeSection` and `Reveal` from `@/components/motion` (already imported in `page.tsx`). Do not add any `await` to `page.tsx` itself.

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
- "Referee starts a voting session, adds time, sees number already voted" → Task 2 (`open_mvp_vote(minutes)`) + Task 6 (control panel: minutes input, live `X/total` turnout via `useMvpTurnout`, countdown) ✓
- "Only invited people can log in and vote" → Task 1/2 (allow-list + `is_mvp_voter()` enforced inside `cast_mvp_vote`; no passcode) + Task 7 (`signInWithGoogle`, then eligibility gate) + Task 6 (voter picker) ✓
- "Show all logged-in users so the admin can pick voters from them" → Task 2 (`list_system_users()` reads `auth.users`, organizer-only) + Task 4 (`listSystemUsers`) + Task 6 (checkbox picker with avatar/name/email, toggling insert/delete on `mvp_voter_allowlist`) ✓
- "Voting is anonymous" → Task 1/2 (receipts vs. ballots split; `cast_mvp_vote` writes both, ballots hold no voter ref; ballots table has no SELECT policy) ✓
- "When time's up or referee ends, everyone sees results" → Task 2 (`get_mvp_results` gated on closed-or-past-deadline; `get_mvp_status` collapses past-deadline → closed) + Task 8 (winners on landing) + Task 6 (manual close) ✓
- Eligibility to exactly 16 → Task 1/2 allow-list + `is_mvp_voter`; Task 6 allow-list editor with `X/16` ✓
- "Each user votes for exactly 1 male + 1 female" → Task 2 (`cast_mvp_vote(p_male_id, p_female_id)` validates each candidate's gender + writes exactly two ballots) + Task 7 (submit disabled until one of each is selected) ✓

**2. Placeholder scan:** SQL, pure logic, data layer, and all four component files contain real code. Remaining "match the existing X" notes point at concrete files (`PlayerAvatar`, `Skeleton`, `Countdown`, `AdminSectionSkeleton`, `RefereeAuthContext`, the `patch`/`busyId` names in `PlayersEditor`) whose exact prop/handler names the implementer must confirm against source — these are verification instructions, not missing logic. No "TODO"/"add validation"/"similar to Task N" placeholders.

**3. Type consistency:** `IMvpStatus`, `IMvpCandidate`, `IMvpResults`, `IMvpGenderResult`, `TGender`, `TMvpStatus`, `ISystemUser` are defined once in Task 3 and consumed with the same field names in Tasks 4/6/7/8. RPC names match between Task 2 (SQL), Task 4 (`database.types.ts` + wrappers), and callers. `get_mvp_status` JSON keys (`voted_count`, `total_eligible`, `is_eligible`, `has_voted`) are mapped to camelCase in exactly one place (`getMvpStatus`) and the raw keys are reused consistently in `useMvpTurnout`.

**4. UI stack (post-#12 shadcn/ui):** all UI tasks (5–8) use `components/ui/*` primitives via `className`, not inline styles. Corrections verified against the migrated codebase: `Countdown` takes an ISO **string**; `AdminSectionSkeleton` takes a `title` prop; `PlayerAvatar` takes `player: IPlayer` (candidates pass through as `IPlayer`-compatible; `ISystemUser` uses shadcn `Avatar` instead); there is **no `Checkbox`** so the voter picker uses a toggle `Button` (`success`/`outline`); confirmations use `AlertDialog`; landing section wraps in `<Reveal>`. Every referenced primitive (`Button`, `Card`, `Input`, `Label`, `Select`, `Avatar`, `AlertDialog`, `Skeleton`) exists in `components/ui/`; no new primitive needs installing.

## ERD review outcomes (be-architect)

Applied to the plan after review:
- **B1** — added table `GRANT`s (allow-list `select,insert,delete`; receipts/vote `select`; ballots none). This project doesn't auto-expose new tables; without grants the editor + realtime would 500 while RPCs kept working.
- **B2** — reworded all "structural/unbreakable anonymity" claims to "access-control level"; dropped `created_at` from `mvp_receipts` to remove the correlation key.
- **B3 / N4** — loud INVARIANT comment on `mvp_ballots` (never grant/policy it; it's the sole-writer guarantee) and a comment documenting the deliberate audit-column omission.
- **S1** — `mvp_ballots (candidate_id, gender)` is now a composite FK → `players (id, gender)` (needs `unique(id,gender)` on players), enforcing ballot/candidate gender match and blocking re-gendering or hard-deleting a referenced candidate; `getMvpResults` also resolves soft-deleted candidates so votes never silently vanish.
- **S2** — emails stored + compared lower-cased/trimmed (`is_mvp_voter`, `has_voted`, `cast_mvp_vote`, `addMvpVoter`).
- **S4** — `cast_mvp_vote` catches the receipt `unique_violation` and re-raises the friendly "already voted".

**Decisions (resolved by user):**
- **S3 — `reset_tournament()` wipes MVP state.** DECIDED: coupled. The RPC migration redefines `reset_tournament()` to also `perform public.reset_mvp_vote()` (clears receipts + ballots, vote → `idle`). The allow-list is intentionally NOT cleared (a reset is a re-run; keep the picked voters). Note the maintenance coupling: any future `reset_tournament()` change must re-append this call.
- **N1 — tiny-turnout de-anonymization: ACCEPTED.** No threshold suppression. At very low turnout (1–2 voters) the revealed ballots effectively expose those voters' picks — this is accepted for a club prize and documented here and in the anonymity threat-model note. Do not add a suppression gate.

**Known follow-ups (out of scope):**
- **N2** — `mvp_receipts.email` could FK → `mvp_voter_allowlist.email` (would also block removing an allow-list entry for someone who already voted). Minor; not applied.
- **N3** — `gender` doubles as the "is-candidate" flag; `open_mvp_vote` only checks ≥1 male/≥1 female, not that every player has a gender. Consider surfacing a "N players missing gender" hint in the admin players editor so the candidate set isn't silently partial.
- Component-level RTL tests for `VoteFlow`/`MvpControlPanel` are not included (only pure logic is unit-tested, matching the current repo). Add if the team wants UI regression coverage.
