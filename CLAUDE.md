# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Status: STARTER / PROVISIONAL.** This repository is greenfield — no application code exists yet.
> Everything below marked _(planned)_ is an intended convention, not observed fact. When real code
> lands, re-run `/init` and replace planned sections with what the codebase actually does.

## Project

A website for organizing a **club badminton championship**. Two audiences:

- **Public (unauthenticated)** — a landing page showing the championship location, rules, schedule, and
  live/final results and standings.
- **Admin (authenticated)** — an admin area where organizers log in and update match points/results.

## Stack _(planned)_

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Backend / data / auth:** Supabase (Postgres, Auth, Row Level Security)
- **Auth method:** Supabase Auth with Google OAuth. Only allow-listed organizer accounts get admin rights.

> Supabase (not Firebase) was chosen because the domain is relational — players, matches, sets, points,
> standings — which maps cleanly to Postgres and makes computing standings/history straightforward.

## Commands _(planned — confirm against `package.json` once it exists)_

```bash
npm run dev          # start local dev server
npm run build        # production build — run before every commit
npm run lint         # ESLint
npm run test         # run the test suite
npm run test -- <path-or-pattern>   # run a single test file / matching tests
```

Supabase local dev (if using the Supabase CLI):

```bash
supabase start       # boot local Postgres + Auth stack
supabase db diff     # generate a migration from schema changes
supabase db reset    # re-apply all migrations + seed to local DB
```

## Architecture _(planned)_

The intended shape — a single Next.js app with a clear public/admin split:

- **Public routes** — server-rendered, read-only. Read published results/standings via Supabase using the
  anon key; RLS restricts what anonymous users can see.
- **Admin routes** — gated behind Supabase Auth (Google). Writes to match/point data happen here only.
- **Data access** — go through a small typed data layer (e.g. `lib/supabase/`) rather than calling the
  Supabase client ad hoc from components. Keep queries in one place so schema changes have one blast radius.
- **Authorization is enforced in the database (RLS), not just the UI.** Hiding an admin button is not
  security — every write must be protected by a Postgres policy that checks the caller is an organizer.
- **`/admin`** — gated area (delivered in the admin-dashboard plan, 2026-08-04) for organizers to edit
  players/pairs, tournament rewards, and drive the tournament lifecycle. `/referee` remains the live scoring
  UI.
- **`tournament`** — singleton table (`id = true`) holding `status` (`setup` → `live` → `done`) and `rewards`.
  `start_tournament()`/`reset_tournament()` RPCs (organizer-only, `SECURITY DEFINER`) drive the transitions;
  `reset_tournament()` also zeroes all match scores/state back to `next`.
- **Write-phase gates:** RLS on `players`/`pairs` only allows organizer updates while `status='setup'`
  (roster locked once live); RLS on `matches` only allows organizer score updates while `status='live'`
  (scoring locked during setup). Both proven against local Postgres, not just the UI.
- **`avatars` storage bucket** — public-read, organizer-write (insert/update), used by the admin players
  editor for uploaded avatar photos.

Likely core tables: `players`, `matches`, `match_sets` (or `points`), and a `results`/standings view derived
from them. Prefer a **database view or computed query** for standings over storing a denormalized copy.

## Database conventions

- Migrations are the **only** way to change schema — never edit the DB by hand in the dashboard for anything
  that must be reproducible. Commit migration files.
- Prefer soft deletes (`deleted_at timestamptz`) over hard deletes for domain records.
- Use `TEXT` over `VARCHAR(n)`; use `uuid` primary keys (`gen_random_uuid()`).
- Every table readable/writable by clients needs an explicit RLS policy. Default deny.

## Frontend conventions

- **`npm run build` must pass before any commit** — a broken build is never committed.
- Convert API/DB payloads at the boundary; keep `snake_case` (Postgres) vs `camelCase` (TS) conversion in the
  data layer, not scattered through components.
- Null-safety: data from Supabase is `T | null` — handle the null/empty/loading states explicitly in the UI.
- Keep components presentational; put data fetching and mutations in the data layer / server actions.
- New screens get a short design pass before components are written — don't design in JSX.

## Testing

- TDD: write the failing test first, then the code that makes it pass (Red → Green → Refactor).
- Cover the data layer (query/standings logic) and admin mutation flows; these carry the real domain risk.

## Git & workflow conventions

- Branches: `main` (production, protected) · `develop` (integration) · `feature/{slug}` · `fix/{slug}`.
- **Atomic commits** — one task per commit, tests/build passing. Title only, no body:
  `type(scope): what changed` — types: `feat` · `fix` · `test` · `refactor` · `chore` · `docs`.
  Example: `feat(admin): update match points form`.
- Commit under the user's configured git identity, never Claude's.
- **Plan before code.** Non-trivial work gets an approved plan in `.planning/plans/` first; unclear work gets
  a spec in `.planning/specs/` first. Only genuinely trivial changes skip straight to implementation.

## Security guardrails

- Never commit secrets. Supabase URL + anon key go in `.env.local` (gitignore'd); the **service-role key
  never ships to the client** and is only used server-side if at all.
- Confirm before destructive or irreversible operations (dropping tables, `db reset` against non-local, force-push).
