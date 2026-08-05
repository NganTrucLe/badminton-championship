-- Editable votes: link each ballot to its voter so a voter can change their picks while the
-- vote is open. This RELAXES the earlier unlinkable-ballot anonymity to access-control level:
-- mvp_ballots still has NO client grant and NO RLS policy (reads only via SECURITY DEFINER
-- RPCs, which never expose voter_email), so the app/organizer UI never shows who voted for
-- whom -- but the DB now stores the voter<->choice link. (User decision, supersedes the
-- original "unlinkable 2-table" choice.)

alter table public.mvp_ballots add column if not exists voter_email text;

-- One male + one female ballot per voter; also the conflict target for the upsert below.
create unique index if not exists mvp_ballots_voter_gender_key
  on public.mvp_ballots (voter_email, gender);

-- cast_mvp_vote now UPSERTS the caller's two ballots, so re-submitting edits the vote
-- instead of being rejected as a double-vote.
create or replace function public.cast_mvp_vote(p_male_id uuid, p_female_id uuid)
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
  if not exists (select 1 from public.players
      where id = p_male_id and gender = 'male' and deleted_at is null) then
    raise exception 'invalid male candidate' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players
      where id = p_female_id and gender = 'female' and deleted_at is null) then
    raise exception 'invalid female candidate' using errcode = '22023';
  end if;

  insert into public.mvp_receipts (email) values (v_email) on conflict (email) do nothing;
  insert into public.mvp_ballots (gender, candidate_id, voter_email)
    values ('male', p_male_id, v_email), ('female', p_female_id, v_email)
  on conflict (voter_email, gender) do update set candidate_id = excluded.candidate_id;
end;
$$;
revoke all on function public.cast_mvp_vote(uuid, uuid) from public;
grant execute on function public.cast_mvp_vote(uuid, uuid) to authenticated;

-- The caller's OWN current picks (never anyone else's), so the vote UI can pre-select them
-- for editing. Returns nothing before the voter has cast.
create or replace function public.get_my_mvp_vote()
  returns table (gender text, candidate_id uuid)
  language sql security definer set search_path = public stable
as $$
  select b.gender, b.candidate_id
  from public.mvp_ballots b
  where b.voter_email = lower(auth.jwt() ->> 'email');
$$;
revoke all on function public.get_my_mvp_vote() from public;
grant execute on function public.get_my_mvp_vote() to authenticated;
