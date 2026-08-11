-- supabase/migrations/20260811000000_round_one_delete_policy.sql
-- Allow organizers to delete matches during setup so the "send đội hình" flow can regenerate
-- round 1 from the current pairs. Mirrors the "organizers edit ... in setup" policies. Scoring
-- (UPDATE) and INSERT policies are unchanged; DELETE stays denied once the tournament is live.

create policy "organizers delete matches in setup" on public.matches
  for delete using (public.is_organizer() and public.is_setup_phase());

grant delete on public.matches to authenticated;
