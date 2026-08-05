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
