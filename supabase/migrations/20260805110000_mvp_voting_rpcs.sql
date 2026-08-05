-- MVP voting: RPC surface. All SECURITY DEFINER, search_path pinned.

-- Is the current auth email on the allow-list?
-- Emails are stored lower-cased (see addMvpVoter + cast_mvp_vote) and compared lower-cased,
-- so a casing/whitespace mismatch can never silently disqualify an eligible voter.
create or replace function public.is_mvp_voter()
  returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mvp_voter_allowlist a
    where a.email = lower(auth.jwt() ->> 'email')
  );
$$;
revoke all on function public.is_mvp_voter() from public;
grant execute on function public.is_mvp_voter() to anon, authenticated;

-- Organizer-only: list everyone who has signed in (safe subset of auth.users), so the
-- admin can pick voters instead of typing emails. Returns nothing for non-organizers.
create or replace function public.list_system_users()
  returns table (id uuid, email text, name text, avatar_url text)
  language sql security definer set search_path = public stable
as $$
  select u.id,
         u.email,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  from auth.users u
  where public.is_organizer() and u.email is not null
  order by coalesce(u.raw_user_meta_data ->> 'full_name', u.email);
$$;
revoke all on function public.list_system_users() from public;
grant execute on function public.list_system_users() to authenticated;

-- Public status snapshot. Collapses past-deadline -> 'closed'.
create or replace function public.get_mvp_status()
  returns json language sql security definer set search_path = public stable
as $$
  select json_build_object(
    'status', case
        when v.status = 'open' and (v.deadline is null or now() >= v.deadline) then 'closed'
        else v.status end,
    'deadline', v.deadline,
    'voted_count', (select count(*) from public.mvp_receipts),
    'total_eligible', (select count(*) from public.mvp_voter_allowlist),
    'is_eligible', public.is_mvp_voter(),
    'has_voted', exists (
        select 1 from public.mvp_receipts r where r.email = lower(auth.jwt() ->> 'email'))
  )
  from public.mvp_vote v where v.id = true;
$$;
revoke all on function public.get_mvp_status() from public;
grant execute on function public.get_mvp_status() to anon, authenticated;

-- Tallies. Returns rows ONLY when effectively closed; empty while idle/open.
create or replace function public.get_mvp_results()
  returns table (gender text, candidate_id uuid, votes bigint)
  language sql security definer set search_path = public stable
as $$
  select b.gender, b.candidate_id, count(*)::bigint as votes
  from public.mvp_ballots b
  where exists (
    select 1 from public.mvp_vote v
    where v.id = true
      and (v.status = 'closed'
        or (v.status = 'open' and v.deadline is not null and now() >= v.deadline))
  )
  group by b.gender, b.candidate_id;
$$;
revoke all on function public.get_mvp_results() from public;
grant execute on function public.get_mvp_results() to anon, authenticated;

-- Cast a ballot: 1 receipt + 2 ballots, atomic. Enforces eligibility, window, no-double.
create or replace function public.cast_mvp_vote(
  p_male_id uuid, p_female_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if v_email is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;
  if not public.is_mvp_voter() then
    raise exception 'not eligible to vote' using errcode = '42501';
  end if;
  if not public.is_mvp_open() then
    raise exception 'voting is not open' using errcode = '42501';
  end if;
  if exists (select 1 from public.mvp_receipts r where r.email = v_email) then
    raise exception 'already voted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.players p
      where p.id = p_male_id and p.gender = 'male' and p.deleted_at is null) then
    raise exception 'invalid male candidate' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players p
      where p.id = p_female_id and p.gender = 'female' and p.deleted_at is null) then
    raise exception 'invalid female candidate' using errcode = '22023';
  end if;

  -- Receipt PK on email is the real double-vote guard; the exists() check above is a fast path
  -- that loses a concurrent race. Translate the unique violation into the friendly error so two
  -- simultaneous submits from the same account both get "already voted", never a raw 23505.
  -- Atomicity: if this raises, the whole function rolls back — no orphan ballots.
  begin
    insert into public.mvp_receipts (email) values (v_email);
  exception when unique_violation then
    raise exception 'already voted' using errcode = '42501';
  end;
  insert into public.mvp_ballots (gender, candidate_id)
    values ('male', p_male_id), ('female', p_female_id);
end;
$$;
revoke all on function public.cast_mvp_vote(uuid, uuid) from public;
grant execute on function public.cast_mvp_vote(uuid, uuid) to authenticated;

-- Organizer: open a fresh vote. Wipes prior receipts/ballots so re-runs start clean.
create or replace function public.open_mvp_vote(p_minutes int)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'minutes must be positive' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players
      where gender = 'male' and deleted_at is null) then
    raise exception 'no male candidates' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players
      where gender = 'female' and deleted_at is null) then
    raise exception 'no female candidates' using errcode = '22023';
  end if;

  delete from public.mvp_ballots;
  delete from public.mvp_receipts;
  update public.mvp_vote
    set status = 'open',
        opened_at = now(), deadline = now() + make_interval(mins => p_minutes),
        updated_at = now()
    where id = true;
end;
$$;
revoke all on function public.open_mvp_vote(int) from public;
grant execute on function public.open_mvp_vote(int) to authenticated;

-- Organizer: end the vote now (results become visible).
create or replace function public.close_mvp_vote()
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.mvp_vote set status = 'closed', updated_at = now() where id = true;
end;
$$;
revoke all on function public.close_mvp_vote() from public;
grant execute on function public.close_mvp_vote() to authenticated;

-- Organizer: reset to idle and clear all votes.
create or replace function public.reset_mvp_vote()
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.mvp_ballots;
  delete from public.mvp_receipts;
  update public.mvp_vote
    set status = 'idle', opened_at = null, deadline = null,
        updated_at = now()
    where id = true;
end;
$$;
revoke all on function public.reset_mvp_vote() from public;
grant execute on function public.reset_mvp_vote() to authenticated;

-- Couple the tournament reset to the MVP reset: redefine reset_tournament() to also wipe MVP
-- receipts/ballots and return the vote to 'idle'. Body below is the CURRENT reset_tournament()
-- from 20260805000000_swiss_generation.sql, verbatim, with `perform public.reset_mvp_vote()`
-- appended. Must come AFTER reset_mvp_vote is defined (above). If reset_tournament() changes in
-- a later migration, that migration must re-append this call.
create or replace function public.reset_tournament()
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- drop generated rounds; zero the round-1 scores; back to setup
  delete from public.matches where round_n >= 2;
  update public.matches set score_a = 0, score_b = 0, state = 'next' where round_n = 1 and deleted_at is null;
  update public.tournament set status = 'setup', updated_at = now() where id = true;
  -- also clear the MVP vote (receipts, ballots, back to idle)
  perform public.reset_mvp_vote();
end;
$$;
revoke all on function public.reset_tournament() from public;
grant execute on function public.reset_tournament() to authenticated;

-- Hardening (from Task 1 ERD/review): TRUNCATE bypasses RLS, and the cluster default ACL grants
-- TRUNCATE/REFERENCES/TRIGGER to anon/authenticated on every new public table. Revoke them from
-- the new voting tables so no non-organizer session can wipe votes/turnout. Scoped to these tables
-- (not schema-wide) to avoid changing behavior of the rest of the schema.
revoke truncate, references, trigger on
  public.mvp_vote, public.mvp_voter_allowlist, public.mvp_receipts, public.mvp_ballots
  from anon, authenticated;
