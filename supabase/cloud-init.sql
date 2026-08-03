-- ============================================================
-- Badminton Championship — cloud bootstrap (schema + seed)
-- Run this ONCE against the cloud project (SQL Editor) if you are
-- not using 'supabase db push'. Safe to re-run for tables
-- (create ... if not exists); policies error if already present.
-- ============================================================

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

-- ---------- SEED ----------
-- Seed data ported verbatim from lib/tournament/data.ts (TEAMS, MATCHES, ROUND_META), which in
-- turn was ported from the design prototype. Applied via `supabase db reset`.
--
-- UUIDs below are fixed literals (not gen_random_uuid()) so pairs/matches can reference players
-- deterministically within this single seed file, and so re-running `db reset` is idempotent.

-- players -------------------------------------------------------------------
-- id                                     name          tier  avatar_key
insert into public.players (id, name, tier, avatar_key) values
  ('a0000000-0000-0000-0000-000000000001', 'Trung',       1, 'trung-avatar'),
  ('a0000000-0000-0000-0000-000000000002', 'Kiên',        4, null),
  ('a0000000-0000-0000-0000-000000000003', 'Minh Anh',    2, 'minhanh-avatar'),
  ('a0000000-0000-0000-0000-000000000004', 'Bình',        3, null),
  ('a0000000-0000-0000-0000-000000000005', 'Vinh',        2, 'vinh-avatar'),
  ('a0000000-0000-0000-0000-000000000006', 'Trúc',        3, 'truc-avatar'),
  ('a0000000-0000-0000-0000-000000000007', 'Vũ',          2, null),
  ('a0000000-0000-0000-0000-000000000008', 'Quang Hào',   3, 'hao-avatar'),
  ('a0000000-0000-0000-0000-000000000009', 'Duy',         1, 'duy-avatar'),
  ('a0000000-0000-0000-0000-000000000010', 'Huy Nguyễn',  4, null),
  ('a0000000-0000-0000-0000-000000000011', 'Tùng',        1, 'tung-avatar'),
  ('a0000000-0000-0000-0000-000000000012', 'Mỹ Hồ',       4, 'myho-avatar'),
  ('a0000000-0000-0000-0000-000000000013', 'Nhân',        1, 'nhan-avatar'),
  ('a0000000-0000-0000-0000-000000000014', 'Gái',         4, 'gai-avatar'),
  ('a0000000-0000-0000-0000-000000000015', 'Phát',        2, 'phat-avatar'),
  ('a0000000-0000-0000-0000-000000000016', 'Hùng Bùi',    3, null);

-- pairs -----------------------------------------------------------------
-- id                                     code  name                    player1_id                              player2_id
insert into public.pairs (id, code, name, player1_id, player2_id) values
  ('b0000000-0000-0000-0000-000000000001', 'A', 'Trung – Kiên',        'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'B', 'Minh Anh – Bình',     'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000003', 'C', 'Vinh – Trúc',         'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000004', 'D', 'Vũ – Quang Hào',      'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008'),
  ('b0000000-0000-0000-0000-000000000005', 'E', 'Duy – Huy Nguyễn',    'a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000010'),
  ('b0000000-0000-0000-0000-000000000006', 'F', 'Tùng – Mỹ Hồ',        'a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000012'),
  ('b0000000-0000-0000-0000-000000000007', 'G', 'Nhân – Gái',          'a0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000014'),
  ('b0000000-0000-0000-0000-000000000008', 'H', 'Phát – Hùng Bùi',     'a0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000016');

-- rounds ------------------------------------------------------------------
insert into public.rounds (n, title, time_label, sub) values
  (1, 'Round 1', '09:00 – 09:40', 'Ghép cặp mở màn'),
  (2, 'Round 2', '09:40 – 10:20', 'Ghép theo thành tích'),
  (3, 'Round 3', '10:20 – 10:50', 'Ghép theo thành tích'),
  (4, 'Round 4', '10:50 – 11:10', 'Có trận đấu chéo'),
  (5, 'Round 5', '11:10 – 11:25', 'Chốt suất cuối');

-- matches -------------------------------------------------------------------
-- code round court time  pair_a  pair_b  score_a score_b state
insert into public.matches (code, round_n, court, time_label, pair_a_id, pair_b_id, score_a, score_b, state) values
  ('M1', 1, 1, '09:00', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 21, 15, 'done'),
  ('M2', 1, 2, '09:00', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', 21, 18, 'done'),
  ('M3', 1, 1, '09:20', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000007', 21, 19, 'done'),
  ('M4', 1, 2, '09:20', 'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000008', 21, 17, 'done'),
  ('M5', 2, 1, '09:40', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 17, 14, 'live'),
  ('M6', 2, 2, '09:40', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 0, 0, 'next'),
  ('M7', 2, 1, '10:00', 'b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000008', 0, 0, 'next'),
  ('M8', 2, 2, '10:00', 'b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000007', 0, 0, 'next');
