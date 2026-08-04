-- Swiss generation: rounds 2+ are generated, not seeded. Delete any pre-seeded round>=2 matches
-- (idempotent), and make reset_tournament() clear scores AND drop generated rounds so a reset
-- returns to a clean round-1-only state.

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
