-- Phase 2: core tournament schema (players, pairs, rounds, matches, organizers).
--
-- Deliberate deviation from the repo's default "no FK" convention (see plan
-- .planning/plans/badminton-championship.md): Supabase's PostgREST embedding, cascades, and RLS
-- all lean on real foreign keys, so pairs.player*_id and matches.pair_*_id use FKs here.

create extension if not exists "pgcrypto";

-- players -----------------------------------------------------------------

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier int not null check (tier between 1 and 4),
  avatar_key text null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- pairs ---------------------------------------------------------------------

create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  player1_id uuid not null references public.players (id),
  player2_id uuid not null references public.players (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- rounds ----------------------------------------------------------------

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  n int not null unique check (n between 1 and 5),
  title text not null,
  time_label text not null,
  sub text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- matches -------------------------------------------------------------------

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  round_n int not null,
  court int not null,
  time_label text not null,
  pair_a_id uuid not null references public.pairs (id),
  pair_b_id uuid not null references public.pairs (id),
  score_a int not null default 0,
  score_b int not null default 0,
  state text not null default 'next' check (state in ('next', 'live', 'done')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- organizers ------------------------------------------------------------

create table if not exists public.organizers (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Row Level Security ----------------------------------------------------

alter table public.players enable row level security;
alter table public.pairs enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.organizers enable row level security;

-- Public (anon) read access on tournament data. No write policies in Phase 2 — writes land in
-- Phase 3/4 gated by an is_organizer() check.
create policy "players are publicly readable" on public.players
  for select using (true);

create policy "pairs are publicly readable" on public.pairs
  for select using (true);

create policy "rounds are publicly readable" on public.rounds
  for select using (true);

create policy "matches are publicly readable" on public.matches
  for select using (true);

-- organizers: RLS enabled, no policy defined -> default deny for anon/authenticated. Managed via
-- SQL/dashboard for v1.

-- Grants -------------------------------------------------------------------
-- New tables are not auto-exposed to the Data API roles by default (see [api] config notes), so
-- grant SELECT explicitly. RLS policies above still gate which *rows* are visible; this only
-- grants table-level access. organizers gets no grant here (default-deny, RLS enabled anyway).
grant select on public.players to anon, authenticated;
grant select on public.pairs to anon, authenticated;
grant select on public.rounds to anon, authenticated;
grant select on public.matches to anon, authenticated;
