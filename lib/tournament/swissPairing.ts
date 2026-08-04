/**
 * Pure Swiss-pairing engine for the club badminton championship. Implements
 * `.memory/knowledge/swiss-format.md` (Round N+1 generation rules 1–7) exactly.
 *
 * Deliberately framework-free (no React, no Supabase/DB) so it is directly unit-testable and
 * usable from both server and client code. Callers apply the result (inserting matches / marking
 * a bye) — this module only computes pairings.
 */

import { TEAMS, type IMatch } from "@/lib/tournament/data";
import { buildTeamRecords, type TTeamRecords } from "@/lib/tournament/standings";

export interface IGeneratedPair {
  aTeamId: number;
  bTeamId: number;
}

export interface IGenerationResult {
  round: number;
  pairs: IGeneratedPair[];
  bye: number | null;
  forcedRematches: Array<[number, number]>;
}

export function latestRound(matches: IMatch[]): number {
  return matches.reduce((mx, m) => Math.max(mx, m.round), 0);
}

export function isRoundComplete(matches: IMatch[], round: number): boolean {
  const rm = matches.filter((m) => m.round === round);
  return rm.length > 0 && rm.every((m) => m.state === "done");
}

/** team id -> set of team ids it has already played (counts only 'done' matches). */
export function priorOpponents(matches: IMatch[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  const add = (x: number, y: number) => {
    if (!map.has(x)) map.set(x, new Set());
    map.get(x)!.add(y);
  };
  matches
    .filter((m) => m.state === "done")
    .forEach((m) => {
      add(m.a, m.b);
      add(m.b, m.a);
    });
  return map;
}

function alive(records: TTeamRecords, id: number): boolean {
  return records[id].w < 3 && records[id].l < 3;
}

/** Standing order within a group: wins desc, then (pf-pa) desc, then letter (id) asc. */
function standingOrder(ids: number[], records: TTeamRecords): number[] {
  return [...ids].sort((x, y) => {
    const rx = records[x];
    const ry = records[y];
    return ry.w - rx.w || (ry.pf - ry.pa) - (rx.pf - rx.pa) || x - y;
  });
}

/** Fold-pair an even list, avoiding rematches; returns pairs (+ any forced rematches). */
function foldPair(
  order: number[],
  prior: Map<number, Set<number>>,
  forced: Array<[number, number]>,
): IGeneratedPair[] {
  // Try a rematch-free perfect matching via backtracking over `order`; fall back to fold with
  // minimum forced rematches. (order is small — <=8 — so backtracking is trivial.)
  const n = order.length;
  const used = new Array(n).fill(false);
  const result: IGeneratedPair[] = [];
  const played = (a: number, b: number) => prior.get(a)?.has(b) === true;

  function backtrack(): boolean {
    const i = used.indexOf(false);
    if (i === -1) return true;
    used[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (used[j] || played(order[i], order[j])) continue;
      used[j] = true;
      result.push({ aTeamId: order[i], bTeamId: order[j] });
      if (backtrack()) return true;
      result.pop();
      used[j] = false;
    }
    used[i] = false;
    return false;
  }

  if (backtrack()) return result;

  // No rematch-free matching exists -> fold pair and record forced rematches.
  used.fill(false);
  result.length = 0;
  const mid = n / 2;
  for (let i = 0; i < mid; i++) {
    const a = order[i];
    const b = order[i + mid];
    result.push({ aTeamId: a, bTeamId: b });
    if (played(a, b)) forced.push([a, b]);
  }
  return result;
}

export function generateNextRound(matches: IMatch[]): IGenerationResult | null {
  const round = latestRound(matches);
  if (round === 0 || !isRoundComplete(matches, round)) return null;

  const records = buildTeamRecords(matches);
  const aliveIds = TEAMS.map((t) => t.id).filter((id) => alive(records, id));
  const qualified = TEAMS.filter((t) => records[t.id].w >= 3).length;
  if (aliveIds.length < 2 || qualified >= 4) return null;

  // Group by record, order groups (wins desc, losses asc)
  const groupKey = (id: number) => `${records[id].w}-${records[id].l}`;
  const keys = Array.from(new Set(aliveIds.map(groupKey))).sort((x, y) => {
    const [wx, lx] = x.split("-").map(Number);
    const [wy, ly] = y.split("-").map(Number);
    return wy - wx || lx - ly;
  });

  const prior = priorOpponents(matches);
  const forced: Array<[number, number]> = [];
  const pairs: IGeneratedPair[] = [];
  let floater: number | null = null;
  let bye: number | null = null;

  keys.forEach((key, gi) => {
    let ids = aliveIds.filter((id) => groupKey(id) === key);
    ids = standingOrder(ids, records);
    if (floater !== null) {
      ids = [...ids, floater];
      floater = null;
      ids = standingOrder(ids, records);
    }
    if (ids.length % 2 === 1) {
      if (gi < keys.length - 1) {
        floater = ids[ids.length - 1]; // lowest floats down
        ids = ids.slice(0, -1);
      } else {
        bye = ids[ids.length - 1]; // last group odd -> lowest gets the bye
        ids = ids.slice(0, -1);
      }
    }
    pairs.push(...foldPair(ids, prior, forced));
  });

  return { round: round + 1, pairs, bye, forcedRematches: forced };
}
