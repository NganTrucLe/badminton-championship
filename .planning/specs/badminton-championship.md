# Spec — Badminton Championship Website

**Status:** Draft — awaiting approval
**Date:** 2026-08-03
**Author:** Truc Le (with Claude)

---

## Problem

A badminton club runs a championship and currently has no single place for participants and spectators to
see **where it's held, the rules, who's playing, and how matches are going**. Organizers need a simple way to
**record match progress live** so the public view stays current without manual spreadsheet wrangling or group-chat
score updates.

## Audiences

- **Public (unauthenticated)** — anyone with the link. Read-only: location, rules, schedule, pairings, live
  scores, and standings.
- **Admin / organizer (authenticated)** — a small allow-listed group. Records live scores and manages the
  championship data.

## Proposed solution

A single **Next.js (App Router) + TypeScript + Tailwind** web app backed by **Supabase** (Postgres, Auth, RLS,
Realtime).

### Public site
- **Landing page** — championship name, location, dates, rules, and a call-out to current/next matches.
- **Standings page** — Swiss standings table (wins, game/point differential, tiebreakers).
- **Matches / schedule** — list of rounds and pairings with status (upcoming / live / final) and scores.
- Live scores update in near-real-time via **Supabase Realtime** (no manual refresh).

### Admin site
- **Google login** (Supabase Auth). Access restricted to an **allow-list table** of approved organizers,
  enforced by Postgres RLS.
- **Live scoring screen** — for an in-progress doubles match, increment each side's points tap-by-tap; the
  public view reflects it live.
- **Championship management** — manage pairs (teams), rounds, and match pairings; confirm final results.

### Domain model (doubles, Swiss)
- **`players`** — individual club members.
- **`pairs`** (teams) — two players form a doubles pair; the pair is the competing unit.
- **`rounds`** — Swiss rounds (round 1..N).
- **`matches`** — one match = pair A vs pair B in a given round, with status and a score per game/set.
- **`games`** (or `match_games`) — per-game point tallies within a match (badminton is best-of-3 games to 21).
- **`organizers`** — allow-list of user IDs/emails permitted to write.
- **Standings** — a derived Postgres **view/query** from finished matches (Swiss points + tiebreakers), not a
  stored table.

### Authorization
- All writes (scores, pairings, results) require the caller to be in `organizers`, enforced by **RLS policies** —
  not just by hiding admin UI. Public reads are anon-key + RLS-restricted to published data.

## Out of scope (v1)

- **Automatic Swiss pairing generation.** v1 assumes the organizer enters each round's pairings manually
  (or we generate them in a later iteration). Auto-pairing with proper tiebreak/rematch-avoidance is its own project.
- Singles and mixed categories — **doubles only** for v1.
- Player self-registration / accounts for participants — organizers manage the roster.
- Payments, ticketing, notifications/emails, photo galleries.
- Multi-championship / multi-club tenancy — one championship at a time.
- Native mobile apps (responsive web only).

## Trade-offs & risks

- **Live point-by-point scoring is the biggest cost driver.** It adds Supabase Realtime, optimistic UI, and
  careful concurrency handling (what if two organizers score the same match?). A "final score entry only" model
  would be a fraction of the work. Recommend a fallback: **build final-score entry first, layer live updates
  second** — so we ship something usable even if realtime slips.
- **Swiss format needs a defined rule set** (number of rounds, points per win, tiebreakers — Buchholz? head-to-head?
  game/point diff?). Standings logic can't be finalized until these are specified. See open questions.
- **Concurrency on a live match** — need a single source of truth per match and a rule for who can score it
  (e.g. lock a match to one scorer, or last-write-wins on a per-point increment). Cheap to get wrong.
- **Doubles pair identity** — if a player can appear in multiple pairs across the championship, standings and
  history must key on the pair, not the player. Confirm whether pairs are fixed for the whole championship.

## Open questions

1. **Swiss rules** — how many rounds? Points per win/loss? Tiebreak order (Buchholz / head-to-head / point diff)?
   _(User will provide.)_
2. **Match format** — best-of-3 games to 21 (rally point, win by 2, cap at 30)? Or a club variation?
3. **Are pairs fixed** for the whole championship, or can players re-pair between rounds?
4. **Live scoring authority** — can any organizer score any match, or is a match assigned to one scorer?
5. **Landing content** — is rules/location text static (hardcoded/markdown) or admin-editable in v1?
6. **Deployment target** — Vercel + Supabase cloud assumed; confirm.

## Success criteria

- A spectator can open the site and see location, rules, current standings, and live match scores that update
  without refreshing.
- An allow-listed organizer can log in with Google, open a live doubles match, and record points that appear on
  the public view within a couple of seconds.
- A non-organizer cannot write any data, verified at the database (RLS) level, not just the UI.
