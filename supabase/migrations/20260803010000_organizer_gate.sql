-- Phase 3: organizer allow-list + matches write RLS.
--
-- `organizers` already exists (Phase 2) with RLS enabled and no policy, i.e. default-deny for
-- anon/authenticated — no client can SELECT it. We rely on that: membership is only ever checked
-- through `is_organizer()`, a SECURITY DEFINER function, so the allow-list itself is never
-- exposed to clients. This migration also defensively revokes any table-level grant on
-- `organizers` in case an earlier environment picked up a default grant.

revoke all on public.organizers from anon, authenticated;

-- is_organizer() --------------------------------------------------------
-- Returns true when the caller's JWT email is present in public.organizers. SECURITY DEFINER so
-- it can read organizers (which has no SELECT policy for anon/authenticated) without granting
-- table access to callers. search_path is pinned to avoid search_path hijacking in a
-- SECURITY DEFINER function.
create or replace function public.is_organizer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organizers o
    where o.email = auth.jwt() ->> 'email'
  );
$$;

revoke all on function public.is_organizer() from public;
grant execute on function public.is_organizer() to anon, authenticated;

-- matches write policies --------------------------------------------------
-- Phase 3 adds the authorization layer only; Phase 4 wires the actual UPDATE call from the
-- referee UI. Only allow-listed organizers (per is_organizer()) may write.
create policy "organizers can update matches" on public.matches
  for update using (public.is_organizer())
  with check (public.is_organizer());

create policy "organizers can insert matches" on public.matches
  for insert with check (public.is_organizer());

grant update, insert on public.matches to authenticated;
