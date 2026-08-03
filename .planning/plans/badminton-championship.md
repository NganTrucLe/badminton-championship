# Plan — Badminton Championship Website (Next.js + Supabase)

**Status:** All phases (0–4) complete 2026-08-03. Public site + realtime referee scoring on Supabase.
Remaining: user applies `supabase/cloud-phase4.sql` + confirms end-to-end sign-in; deferred follow-ups below.
**Spec:** `.planning/specs/badminton-championship.md`
**Design reference:** `.design-reference/Giai Cau Long CLB.dc.html` (Claude Design `.dc` prototype — local-state mockup)
**Date:** 2026-08-03

---

## Goal

Turn the approved design into a real, deployable, **multi-user** app: public visitors see live standings/scores;
allow-listed referees log in with Google and update scores that appear on everyone's screen within ~1–2s.

The design already resolves the Swiss/doubles rules and provides all screen layouts, real player data (8 pairs,
16 players, 4 tiers), and the standings/Swiss-board computation logic — we **port** it, we don't redesign it.

---

## Architecture

- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS.
- **Backend:** Supabase — Postgres, Auth (Google OAuth), Row Level Security, Realtime.
- **Routing:** real routes replace the prototype's tab-state SPA (shareable URLs), one shared layout with the
  sticky pill nav:
  - `/` Trang chủ · `/teams` Các cặp · `/schedule` Lịch & Bảng đấu · `/referee` Trọng tài (protected) · `/rules` Quy tắc
- **Standings/Swiss logic:** port the design's `renderVals()` computation to a shared, pure TypeScript module
  (`lib/tournament/`) — used by both server components and the client. It is complex (record-based grouping,
  rematch avoidance, cross-pairing, qualified/eliminated, playoff seeding); keep it in tested app code rather
  than a SQL view.
- **Realtime:** public pages subscribe to Postgres changes on `matches`; referee writes propagate live.

### Data model (Postgres migrations)

- `players` — `id uuid pk`, `name text`, `tier int (1..4)`, `avatar_path text null`, timestamps, `deleted_at`.
- `pairs` — `id uuid pk`, `code text (A..H)`, `name text`, `player1_id`, `player2_id`, timestamps, `deleted_at`.
- `rounds` — `id uuid pk`, `n int (1..5)`, `title text`, `time_label text`, `sub text`.
- `matches` — `id uuid pk`, `code text (M1..)`, `round_n int`, `court int`, `time_label text`,
  `pair_a_id`, `pair_b_id`, `score_a int default 0`, `score_b int default 0`,
  `state text ('next'|'live'|'done')`, timestamps.
- `organizers` — `email text pk` (allow-list of referees/organizers).
- **Seed** = exactly the design's `TEAMS`, `ROUND_META`, and `MATCHES` so first render matches the mockup.

> **Deliberate deviation from CLAUDE.md "No FK":** that rule targets the Kotlin/Exposed backend. Supabase's
> PostgREST embedding, cascade, and RLS all lean on real FKs, so `pairs.player*_id` and `matches.pair_*_id`
> use foreign keys here. Flagging it because it contradicts the starter conventions doc on purpose.

### Authorization (RLS)

- `players`, `pairs`, `rounds`, `matches`: **public `SELECT`** (anon key).
- `matches` **`UPDATE`** (and later `INSERT`): allowed only when the caller's email is in `organizers`, enforced
  by an `is_organizer()` SQL helper used in the policy — **not** by hiding UI. `organizers` itself is not
  client-writable (managed via Supabase dashboard/SQL for v1).

---

## Phases

Each phase is independently reviewable and ends with lint/build/tests green.

### Phase 0 — Project scaffold & design assets
- `create-next-app` (App Router, TS, Tailwind, ESLint). Add Vitest + Testing Library.
- Pull the 11 avatar JPGs from the design project's `assets/` into `public/avatars/`.
- Global styles: fonts (Archivo / Bricolage Grotesque / JetBrains Mono), color tokens, the `livePulse` /
  `floatUp` keyframes from the design's `<style>`.
- **Deliverable:** `npm run dev` serves an empty shell; `npm run build` passes.

### Phase 1 — Static port of all 5 screens (mock data, no backend)
- Port `TEAMS` / `MATCHES` / `ROUND_META` into `lib/tournament/data.ts`; port `renderVals()` maths into
  pure functions in `lib/tournament/standings.ts` with **unit tests** (records, grouping, qualified/eliminated,
  playoff seeding) derived from known inputs.
- Build components per screen faithfully to the design (Header/nav, Home hero+countdown+live+recent+location+
  rewards, Teams tier cards, Schedule Swiss board + playoff bracket + tracking table, Rules, Referee UI shell).
- Nav switches routes; referee page still uses local state.
- **Deliverable:** clickable site visually matching the prototype, data still local. This is the review gate for
  "does it look right" before wiring the backend.

### Phase 2 — Supabase: schema, seed, read path
- Add Supabase project config + typed client (`@supabase/supabase-js`, generated types).
- Migrations for all tables + RLS SELECT policies; seed script loads the design data.
- Swap public screens (`/`, `/teams`, `/schedule`) from mock data to Supabase reads.
- **Deliverable:** public site renders from the database; `.env.local` documented (never committed).

### Phase 3 — Google auth + organizer gate
- Supabase Google OAuth; sign-in/sign-out replacing the fake buttons.
- `organizers` allow-list + `is_organizer()`; middleware/guard protecting `/referee` (redirect + message for
  non-organizers, matching the design's "signed-out" referee panel).
- **Deliverable:** only allow-listed Google accounts reach the referee tools; verified at the DB level.

### Phase 4 — Referee writes + realtime
- Referee page: select match, ± score, **Lưu tỉ số đang đấu** (`state='live'`), **Kết thúc trận** (`state='done'`)
  → `UPDATE matches` (RLS-guarded).
- Public pages subscribe to `matches` realtime; live match card, recent results, Swiss board, and standings all
  update without refresh.
- Concurrency guard: define behavior when two referees edit one match (v1: last-write-wins on whole-match score,
  documented; a per-match "claimed by" lock is a noted follow-up).
- **Deliverable:** end-to-end — referee updates a score, a second browser sees it live.

### Out of scope (this plan) — flagged follow-ups
- **Auto Swiss pairing generation** and **organizer match/round creation UI** (v1 seeds all matches; the board
  auto-*groups* by record but does not auto-*pair*). Editing scores works; creating next-round pairings is manual
  via seed/SQL for now — consistent with the spec.
- Self-service organizer management UI, player/pair CRUD, i18n (app is Vietnamese-only), notifications.

---

## Test strategy

- **Unit (Vitest):** the `lib/tournament/standings.ts` maths — the highest-risk logic — with fixtures covering
  0/1/2/3-win records, rematch avoidance, cross-pairing, qualified/eliminated, and playoff seed order.
- **Component:** referee ± controls and save/finish transitions update state correctly.
- **RLS (manual + scripted):** a non-organizer `UPDATE` on `matches` is rejected by Postgres, not just the UI.
- **E2E smoke (manual per spec success criteria):** two browsers, referee edits → public reflects live.
- Build must pass before every commit; commit atomically per the CLAUDE.md convention.

## Risks

- **Realtime + RLS interaction** — realtime respects RLS; misconfigured SELECT policies silently drop events.
  Mitigate: verify subscription receives updates in Phase 4 with an explicit test.
- **Standings port fidelity** — the design's grouping/pairing display logic is subtle; a faithful port needs the
  unit tests above or the Swiss board will silently diverge from the mockup.
- **Auth redirect URIs** — Google OAuth + Supabase callback URLs differ per env (local vs deployed); document them.
- **Scope creep into match-creation** — easy to drift into building full admin CRUD; hold the line at score
  editing for v1 unless we explicitly expand scope.

## Handoff

Frontend + SQL work, executed by the `fe-plan-executor` agent, phase by phase, lint/build/tests after each,
commit per phase under the user's git identity. Supabase project + Google OAuth credentials are a prerequisite
the user provides before Phase 2 (I will not enter credentials; env vars go in `.env.local`).
