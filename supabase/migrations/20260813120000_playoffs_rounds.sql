-- Playoffs: thêm rounds meta cho bán kết (n=6) và chung kết/hạng 3 (n=7).
-- Không đụng RLS/policy: INSERT/UPDATE matches đã đủ (organizers insert; score khi live).
-- reset_tournament() đã xóa round_n >= 2 nên cũng dọn playoff.
--
-- Deviation from plan: init schema's `rounds.n` has an inline check constraint
-- `n between 1 and 5` (see 20260803000000_init_schema.sql) — widen it to 7 before inserting,
-- otherwise n=6/n=7 rows violate the constraint. Constraint name is the Postgres default for an
-- unnamed inline check on column `n` of table `rounds`.

alter table public.rounds drop constraint if exists rounds_n_check;
alter table public.rounds add constraint rounds_n_check check (n between 1 and 7);

insert into public.rounds (n, title, time_label, sub)
values
  (6, 'Bán kết', '11:30', 'Board 2 · 4 đội qualified'),
  (7, 'Chung kết / Hạng 3', '12:15', 'Board 2 · tranh cúp')
on conflict (n) do nothing;
