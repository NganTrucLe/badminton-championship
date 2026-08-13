/**
 * Pure playoff engine (Board 2). Implements `.memory/knowledge/swiss-format.md` "Terminal /
 * playoffs". Framework-free, DB-free — callers (ensurePlayoffs Server Action) apply the rows.
 * Quy ước: bán kết round_n=6 (court1=BK1, court2=BK2); chung kết/hạng3 round_n=7 (court1=CK, court2=H3).
 */
import type { IMatch, ITeam } from "@/lib/tournament/data";
import { buildTeamRecords, computeSeeds } from "@/lib/tournament/standings";

export interface IPlayoffRow {
  code: string;
  round: number;
  court: number;
  aTeamId: number;
  bTeamId: number;
}

export function qualifiedSeedIds(matches: IMatch[], teams: ITeam[]): number[] {
  const records = buildTeamRecords(matches, teams);
  const seeds = computeSeeds(matches, records, teams);
  return seeds.length >= 4 ? seeds.slice(0, 4).map((s) => s.teamId) : [];
}

export function winnerOf(m: IMatch): number | null {
  if (m.state !== "done") return null;
  return m.sa > m.sb ? m.a : m.sb > m.sa ? m.b : null;
}

export function loserOf(m: IMatch): number | null {
  if (m.state !== "done") return null;
  return m.sa > m.sb ? m.b : m.sb > m.sa ? m.a : null;
}

/** 2 bán kết khi đủ 4 qualified và chưa có round 6. */
export function generateSemis(matches: IMatch[], teams: ITeam[]): IPlayoffRow[] | null {
  if (matches.some((m) => m.round === 6)) return null; // idempotent
  const seeds = qualifiedSeedIds(matches, teams);
  if (seeds.length < 4) return null;
  return [
    { code: "R6-1", round: 6, court: 1, aTeamId: seeds[0], bTeamId: seeds[3] },
    { code: "R6-2", round: 6, court: 2, aTeamId: seeds[1], bTeamId: seeds[2] },
  ];
}

/** Chung kết + hạng 3 khi cả 2 bán kết done và chưa có round 7. */
export function generateFinals(matches: IMatch[]): IPlayoffRow[] | null {
  if (matches.some((m) => m.round === 7)) return null; // idempotent
  const bk1 = matches.find((m) => m.round === 6 && m.court === 1);
  const bk2 = matches.find((m) => m.round === 6 && m.court === 2);
  if (!bk1 || !bk2 || bk1.state !== "done" || bk2.state !== "done") return null;
  const w1 = winnerOf(bk1)!;
  const w2 = winnerOf(bk2)!;
  const l1 = loserOf(bk1)!;
  const l2 = loserOf(bk2)!;
  return [
    { code: "R7-1", round: 7, court: 1, aTeamId: w1, bTeamId: w2 }, // Chung kết
    { code: "R7-2", round: 7, court: 2, aTeamId: l1, bTeamId: l2 }, // Hạng 3
  ];
}
