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
