# Swiss Format — Club Badminton Championship (doubles, 8 pairs)

Authoritative rules for standings + automatic round generation. The pairing engine
(`lib/tournament/swissPairing.ts`) implements this document exactly. Any pairing decision the code
makes must trace to a rule here — if a needed rule is missing, add it here first.

> **Status:** approved 2026-08-04. Both decision points are resolved (see the marked rules).

## Teams & match format
- 8 fixed pairs, letters A–H (immutable codes; numeric ids A=1 … H=8).
- Doubles, best-of-1 (Bo1). A match is played to 21 points.
- **Deuce: NO deuce** (approved decision). The referee reports the final score and the higher score
  wins; the referee only ever ends a completed match, so a tie is not a valid final state.

## Progression
- A pair plays one match per round until it reaches **3 wins → Qualified** or **3 losses →
  Eliminated**. Qualified/Eliminated pairs stop playing.
- "Alive" = wins < 3 AND losses < 3.
- Maximum 5 rounds (with 8 pairs and 3W/3L, every pair resolves within 5 rounds).

## Round 1 (fixed opening draw)
- A–E, B–F, C–G, D–H. Seeded, not generated.

## Round N+1 generation (runs when round N is fully complete)
1. Take the **alive** pairs only.
2. **Group** them by identical (wins–losses) record.
3. **Order groups** by wins descending, then losses ascending.
4. **Standing order within a group:** wins desc → point differential (points_for − points_against)
   desc → pair letter A→H ascending.
5. **Odd group float:** if a group has an odd number of pairs, its lowest-standing pair floats down
   and joins the next (lower) group before that group is paired. Process groups top→bottom.
6. **Pairing within a (now even) group — fold + rematch avoidance:** order the group [t1…tk]; the
   default pairing is fold pairing (t1 vs t(k/2+1), t2 vs t(k/2+2), …). If any default pair is a
   **rematch** (the two already played each other in a prior round), repair that group by searching
   for a rematch-free perfect matching (backtracking; groups are ≤8 so this is trivial). Only if no
   rematch-free matching exists, allow the minimum number of rematches and record which.
7. **Bye: SIT OUT, no record change** (approved decision). A bye is only needed when the total alive
   count is odd (possible when a round removes an odd number of pairs). When that happens, the
   **lowest-standing alive pair overall sits out that round** — it plays no match, its W–L record is
   unchanged, and it is paired normally in the next round. No synthetic opponent, no free win, no
   match row is created for the bye.

## Terminal / playoffs (approved 2026-08-13 — now IN scope)
- Swiss round generation stops when <2 alive pairs remain OR 4 pairs Qualified.
- **Seeding** (4 qualified → seed1..4): wins desc → point differential (pf−pa) desc →
  head-to-head (đội thắng trực tiếp trên) → letter A→H asc.
- **Semifinals** (`round_n=6`, generated when 4 qualified, none exist yet):
  - Sân 1 = Bán kết 1 = seed1 vs seed4; Sân 2 = Bán kết 2 = seed2 vs seed3.
- **Final + 3rd place** (`round_n=7`, generated when BOTH semis `done`, none exist yet):
  - Sân 1 = Chung kết = thắng BK1 vs thắng BK2.
  - Sân 2 = Tranh hạng 3 = thua BK1 vs thua BK2.
- Bo1, no deuce → mọi trận playoff luôn có đúng 1 đội thắng (không bye, không hòa).
- Sinh trận idempotent qua `ensurePlayoffs()` (giống `ensureNextRound()`), gọi sau mỗi trận kết thúc.
- Liên kết Final/3rd → bán kết theo quy ước `round_n`+`court` (không lưu cột nguồn).

## Worked example (why odd groups occur)
- R1: 8 alive → 4 matches. R2 groups: {1-0}×4, {0-1}×4 (even).
- R3 groups: {2-0}×2, {1-1}×4, {0-2}×2 (even). After R3: one pair reaches 3-0 (Qualified),
  one reaches 0-3 (Eliminated) → 6 alive.
- R4 groups: {2-1}×3 (ODD), {1-2}×3 (ODD). The lowest {2-1} pair floats into {1-2}; that group
  becomes 4 and is fold-paired — this is the design's round-4 "trận đấu chéo" (cross match).
- A bye (odd total alive) can arise when a round removes an odd number of pairs (e.g. a cross match
  where the winner qualifies but the loser is not yet eliminated). Then the lowest-standing alive
  pair sits out.
