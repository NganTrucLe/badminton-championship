-- Phase 8: setup-phase match DELETE policy for the CLOUD Supabase project.
-- Paste this into the cloud SQL Editor and run once.
--
-- Idempotent: safe to re-run (drops the policy first before recreating it).
--
-- Enables the "Gửi đội hình" flow to regenerate round-1 matches from the current pairs:
-- regenerateRoundOne() (client, organizer) deletes all match rows and reinserts M1..M4 while
-- the tournament is still in 'setup'. Without this policy the delete silently no-ops on cloud
-- and regeneration fails. Mirrors supabase/migrations/20260811000000_round_one_delete_policy.sql
-- — keep both in sync.

drop policy if exists "organizers delete matches in setup" on public.matches;
create policy "organizers delete matches in setup" on public.matches
  for delete using (public.is_organizer() and public.is_setup_phase());

grant delete on public.matches to authenticated;
