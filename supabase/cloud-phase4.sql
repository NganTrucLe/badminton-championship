-- ============================================================
-- Badminton Championship — cloud Phase 4 (Realtime on matches)
-- Run this ONCE against the cloud project (SQL Editor), after cloud-init.sql (Phase 2) and
-- cloud-phase3.sql (Phase 3) have already been applied.
-- ============================================================

-- Phase 4: enable Supabase Realtime on public.matches so public pages (home live card, recent
-- results, schedule Swiss board / tracking table) receive postgres_changes events without a full
-- reload when a referee updates a score.
--
-- Realtime respects RLS: matches already has a public `select using (true)` policy (Phase 2), so
-- no extra grant/policy is needed here for anon visitors to receive change events — this
-- statement only opts the table into the `supabase_realtime` publication.
--
-- Postgres's `ALTER PUBLICATION ... ADD TABLE` has no `IF NOT EXISTS` form, so this checks
-- `pg_publication_tables` first to make the migration safe to re-run.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end;
$$;
