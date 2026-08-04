-- Phase 6: Swiss generation cutover for the CLOUD Supabase project.
-- Paste this into the cloud SQL Editor and run once.
--
-- Idempotent: safe to re-run. However it is DESTRUCTIVE — it permanently deletes any
-- pre-seeded round >= 2 matches on cloud (those pairings are replaced by the Swiss
-- generation engine going forward). Reset the cloud tournament first if you want to
-- preserve round-1 results before running this.
--
-- Mirrors supabase/migrations/20260805000000_swiss_generation.sql — keep both in sync.

delete from public.matches where round_n >= 2;

create index if not exists matches_round_n_idx on public.matches (round_n);

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
  -- drop generated rounds; zero the round-1 scores; back to setup
  delete from public.matches where round_n >= 2;
  update public.matches set score_a = 0, score_b = 0, state = 'next' where round_n = 1 and deleted_at is null;
  update public.tournament set status = 'setup', updated_at = now() where id = true;
end;
$$;

revoke all on function public.reset_tournament() from public;
grant execute on function public.reset_tournament() to authenticated;
