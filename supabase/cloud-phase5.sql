-- ============================================================
-- Badminton Championship — cloud Phase 5 (Admin dashboard)
-- Run ONCE in the cloud SQL Editor, after cloud-init/phase3/phase4.
-- Safe to re-run (idempotent).
-- ============================================================

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

-- players / pairs: organizers may edit ONLY during setup (locks roster once live) -----------
drop policy if exists "organizers edit players in setup" on public.players;
create policy "organizers edit players in setup" on public.players
  for update using (public.is_organizer() and public.is_setup_phase())
  with check (public.is_organizer() and public.is_setup_phase());

drop policy if exists "organizers edit pairs in setup" on public.pairs;
create policy "organizers edit pairs in setup" on public.pairs
  for update using (public.is_organizer() and public.is_setup_phase())
  with check (public.is_organizer() and public.is_setup_phase());

grant update on public.players to authenticated;
grant update on public.pairs to authenticated;

-- tournament: public reads (status + rewards are public); organizers edit (rewards; status
-- transitions go through the RPCs below but a direct organizer UPDATE is also allowed) -------
drop policy if exists "tournament is publicly readable" on public.tournament;
create policy "tournament is publicly readable" on public.tournament
  for select using (true);

drop policy if exists "organizers edit tournament" on public.tournament;
create policy "organizers edit tournament" on public.tournament
  for update using (public.is_organizer())
  with check (public.is_organizer());

grant select on public.tournament to anon, authenticated;
grant update on public.tournament to authenticated;

-- matches: tighten the existing organizer UPDATE so scoring is only possible while 'live'.
-- (The Phase 3 policy "organizers can update matches" allowed writes in any phase.)
drop policy if exists "organizers can update matches" on public.matches;
drop policy if exists "organizers score matches when live" on public.matches;
create policy "organizers score matches when live" on public.matches
  for update using (
    public.is_organizer()
    and exists (select 1 from public.tournament t where t.id = true and t.status = 'live')
  )
  with check (
    public.is_organizer()
    and exists (select 1 from public.tournament t where t.id = true and t.status = 'live')
  );

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

-- avatars bucket: public read, organizer-only write (uploads from the admin players editor) --
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "organizers upload avatars" on storage.objects;
create policy "organizers upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars' and public.is_organizer());

drop policy if exists "organizers overwrite avatars" on storage.objects;
create policy "organizers overwrite avatars" on storage.objects
  for update using (bucket_id = 'avatars' and public.is_organizer())
  with check (bucket_id = 'avatars' and public.is_organizer());
