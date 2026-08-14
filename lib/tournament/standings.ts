/**
 * Pure standings / Swiss-board computation, ported from the `renderVals()` method of the
 * design prototype's `Component extends DCLogic` class in
 * `.design-reference/Giai Cau Long CLB.dc.html`.
 *
 * Deliberately framework-free (no React) so it is directly unit-testable and usable from
 * both server and client components.
 */

import {
  ROUND_META,
  type IMatch,
  type IRoundMeta,
  type ITeam,
  type TMatchState,
} from "./data";

export interface ITeamRecord {
  id: number;
  w: number;
  l: number;
  pf: number;
  pa: number;
  /** round number -> 'T' (thắng/win) | 'B' (bại/loss) */
  hist: Record<number, "T" | "B">;
}

export type TTeamRecords = Record<number, ITeamRecord>;

export interface ILiveMatchInfo {
  round: string;
  court: number;
  aName: string;
  bName: string;
  aPlayers: string;
  bPlayers: string;
  aScore: number;
  bScore: number;
  /** Percentage string (e.g. "81%") of the leading score out of 21, capped at 100%. */
  pct: string;
}

export interface IRecentResult {
  code: string;
  aName: string;
  bName: string;
  score: string;
}

export interface IStandingsRow {
  rank: string;
  rankColor: string;
  name: string;
  players: string;
  w: number;
  l: number;
}

export interface ITeamChip {
  teamId: number;
  letter: string;
  name: string;
  rec: string;
}

export interface ISwissMatchDisplay {
  code: string;
  no: number;
  meta: string;
  state: string;
  stateColor: string;
  aTeamId: number;
  bTeamId: number;
  aName: string;
  bName: string;
  sa: number | string;
  sb: number | string;
  aBg: string;
  aFg: string;
  aWeight: string;
  bBg: string;
  bFg: string;
  bWeight: string;
}

export interface ISwissGroup {
  label: string;
  sub: string;
  bg: string;
  border: string;
  fg: string;
  matches: ISwissMatchDisplay[];
  chips: ITeamChip[];
  /** Các trận dự kiến (nhãn nguồn "Thắng/Thua trận N") — rỗng với nhóm thật. */
  placeholders: Array<{ no: number; aLabel: string; bLabel: string }>;
}

export interface ISwissColumn {
  round: number;
  title: string;
  time: string;
  sub: string;
  groups: ISwissGroup[];
  status: string;
  statusColor: string;
}

export interface ISemiMatch {
  code: string;
  time: string;
  aName: string;
  bName: string;
  /** Team id khi đã biết đội; 0 khi còn là placeholder hạt giống. */
  aTeamId: number;
  bTeamId: number;
}

export interface IFinalMatch {
  code: string;
  time: string;
  aName: string;
  bName: string;
  /** Team id khi đã biết đội; 0 khi còn là placeholder. */
  aTeamId: number;
  bTeamId: number;
}

export interface ITrackCell {
  v: string;
  color: string;
  weight: string;
}

export interface ITrackRow {
  teamId: number;
  letter: string;
  name: string;
  w: number;
  l: number;
  status: string;
  statusBg: string;
  statusFg: string;
  cells: ITrackCell[];
}

const STATE_META: Record<
  TMatchState,
  { label: string; color: string; bg: string; border: string; meta: string; score: string }
> = {
  done: {
    label: "KẾT THÚC",
    color: "#8AA39C",
    bg: "#FFFDF7",
    border: "rgba(10,31,26,.12)",
    meta: "#8AA39C",
    score: "#0A1F1A",
  },
  live: {
    label: "ĐANG ĐẤU",
    color: "#FF5A47",
    bg: "#0A1F1A",
    border: "#0A1F1A",
    meta: "#6E8A83",
    score: "#F2B544",
  },
  next: {
    label: "SẮP DIỄN RA",
    color: "#0B5D4E",
    bg: "rgba(11,93,78,.05)",
    border: "rgba(10,31,26,.1)",
    meta: "#8AA39C",
    score: "#B9C4C0",
  },
};

/** Record-group color scheme: ahead (more wins), even, or behind (more losses). */
function groupStyle(w: number, l: number): { bg: string; border: string; fg: string } {
  if (w > l) return { bg: "#EEF7F1", border: "#A8D3BB", fg: "#1F7A45" };
  if (w < l) return { bg: "#FBEFE7", border: "#E6C0A4", fg: "#B5562B" };
  return { bg: "#FFF9EC", border: "#EBD7A4", fg: "#A3790A" };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** id -> live team map, used by every name/player-resolving function below. */
type TTeamById = Map<number, ITeam>;

function buildById(teams: ITeam[]): TTeamById {
  return new Map(teams.map((t) => [t.id, t]));
}

function playersLabel(team: ITeam): string {
  return team.players.map((p) => p.name).join(" & ");
}

/** Builds a per-team W/L/points-for/points-against record, counting only 'done' matches. */
export function buildTeamRecords(matches: IMatch[], teams: ITeam[]): TTeamRecords {
  const table: TTeamRecords = {};
  teams.forEach((t) => {
    table[t.id] = { id: t.id, w: 0, l: 0, pf: 0, pa: 0, hist: {} };
  });

  matches
    .filter((m) => m.state === "done")
    .forEach((m) => {
      const A = table[m.a];
      const B = table[m.b];
      A.pf += m.sa;
      A.pa += m.sb;
      B.pf += m.sb;
      B.pa += m.sa;
      if (m.sa > m.sb) {
        A.w++;
        B.l++;
        A.hist[m.round] = "T";
        B.hist[m.round] = "B";
      } else {
        B.w++;
        A.l++;
        B.hist[m.round] = "T";
        A.hist[m.round] = "B";
      }
    });

  return table;
}

export function computeStandingsTable(records: TTeamRecords, teams: ITeam[]): IStandingsRow[] {
  const byId = buildById(teams);
  return Object.values(records)
    .sort((x, y) => y.w - x.w || x.id - y.id)
    .map((r, i) => {
      const team = byId.get(r.id);
      return {
        rank: pad2(i + 1),
        rankColor: i < 4 ? "#0B5D4E" : "#B9C4C0",
        name: team?.name ?? "",
        players: team ? playersLabel(team) : "",
        w: r.w,
        l: r.l,
      };
    });
}

/** The current live match, or the first upcoming ('next') match if nothing is live. */
export function computeLiveMatch(matches: IMatch[], teams: ITeam[]): ILiveMatchInfo | undefined {
  const liveMatch = matches.find((m) => m.state === "live") ?? matches.find((m) => m.state === "next");
  if (!liveMatch) return undefined;

  const byId = buildById(teams);
  const teamA = byId.get(liveMatch.a);
  const teamB = byId.get(liveMatch.b);

  return {
    round: "VÒNG " + liveMatch.round,
    court: liveMatch.court,
    aName: teamA?.name ?? "",
    bName: teamB?.name ?? "",
    aPlayers: teamA ? playersLabel(teamA) : "",
    bPlayers: teamB ? playersLabel(teamB) : "",
    aScore: liveMatch.sa,
    bScore: liveMatch.sb,
    pct: Math.min(100, Math.round((Math.max(liveMatch.sa, liveMatch.sb) / 21) * 100)) + "%",
  };
}

/** The most recent 4 finished matches, newest first. */
export function computeRecentResults(matches: IMatch[], teams: ITeam[]): IRecentResult[] {
  const byId = buildById(teams);
  return matches
    .filter((m) => m.state === "done")
    .slice(-4)
    .reverse()
    .map((m) => ({
      code: m.id,
      aName: byId.get(m.a)?.name ?? "",
      bName: byId.get(m.b)?.name ?? "",
      score: `${m.sa} – ${m.sb}`,
    }));
}

function teamChip(id: number, records: TTeamRecords, byId: TTeamById): ITeamChip {
  const team = byId.get(id);
  const r = records[id];
  return { teamId: id, letter: team?.letter ?? "", name: team?.name ?? "", rec: `${r.w}–${r.l}` };
}

/** Teams that have reached 3 wins (advance to Board 2 / playoffs). */
export function computeQualified(records: TTeamRecords, teams: ITeam[]): ITeamChip[] {
  const byId = buildById(teams);
  return teams.filter((t) => records[t.id].w >= 3).map((t) => teamChip(t.id, records, byId));
}

/** −1 nếu a thắng b trực tiếp, 1 nếu b thắng a, 0 nếu chưa gặp / hòa (không xảy ra: no deuce). */
function headToHead(matches: IMatch[], a: number, b: number): number {
  for (const m of matches) {
    if (m.state !== "done") continue;
    const isAB = (m.a === a && m.b === b) || (m.a === b && m.b === a);
    if (!isAB) continue;
    const aScore = m.a === a ? m.sa : m.sb;
    const bScore = m.a === a ? m.sb : m.sa;
    if (aScore > bScore) return -1;
    if (bScore > aScore) return 1;
  }
  return 0;
}

/** Đội qualified (w≥3) theo thứ tự seed: wins desc → (pf−pa) desc → head-to-head → id asc. */
export function computeSeeds(matches: IMatch[], records: TTeamRecords, teams: ITeam[]): ITeamChip[] {
  const byId = buildById(teams);
  return teams
    .filter((t) => records[t.id].w >= 3)
    .map((t) => t.id)
    .sort((x, y) => {
      const rx = records[x];
      const ry = records[y];
      return ry.w - rx.w || ry.pf - ry.pa - (rx.pf - rx.pa) || headToHead(matches, x, y) || x - y;
    })
    .map((id) => teamChip(id, records, byId));
}

/** Teams that have reached 3 losses (eliminated from the Swiss stage). */
export function computeEliminated(records: TTeamRecords, teams: ITeam[]): ITeamChip[] {
  const byId = buildById(teams);
  return teams.filter((t) => records[t.id].l >= 3).map((t) => teamChip(t.id, records, byId));
}

function isAlive(records: TTeamRecords, id: number): boolean {
  return records[id].w < 3 && records[id].l < 3;
}

function matchDisplay(m: IMatch, byId: TTeamById, no: number): ISwissMatchDisplay {
  const fin = m.state === "done";
  const aWins = fin && m.sa > m.sb;
  const bWins = fin && m.sb > m.sa;

  const rowStyle = (win: boolean, lose: boolean) => {
    if (win) return { bg: "#EAF8EE", fg: "#1A6B3A", weight: "800" };
    if (lose) return { bg: "#FAFAF8", fg: "#9AA09B", weight: "600" };
    return { bg: "#FFFFFF", fg: "#0A1F1A", weight: "700" };
  };

  const A = rowStyle(aWins, fin && !aWins);
  const B = rowStyle(bWins, fin && !bWins);
  const meta = STATE_META[m.state];

  return {
    code: m.id,
    no,
    meta: `Trận ${no} · Sân ${m.court}`,
    state: meta.label,
    stateColor: meta.color,
    aTeamId: m.a,
    bTeamId: m.b,
    aName: byId.get(m.a)?.name ?? "",
    bName: byId.get(m.b)?.name ?? "",
    sa: m.state === "next" ? "–" : m.sa,
    sb: m.state === "next" ? "–" : m.sb,
    aBg: A.bg,
    aFg: A.fg,
    aWeight: A.weight,
    bBg: B.bg,
    bFg: B.fg,
    bWeight: B.weight,
  };
}

function roundStatus(matches: IMatch[]): { status: string; statusColor: string } {
  const anyLive = matches.some((m) => m.state === "live");
  const allDone = matches.length > 0 && matches.every((m) => m.state === "done");
  if (allDone) return { status: "HOÀN TẤT", statusColor: "#8AA39C" };
  if (anyLive) return { status: "ĐANG DIỄN RA", statusColor: "#FF5A47" };
  return { status: "CHƯA BẮT ĐẦU", statusColor: "#B4BEBA" };
}

/** Số trận toàn giải bắt đầu mỗi vòng (cấu trúc cố định 8 đội — xem swiss-format.md). */
const ROUND_START: Record<number, number> = { 1: 1, 2: 5, 3: 9, 4: 13, 5: 16 };

/**
 * Các trận dự kiến theo vòng cho giải 8 đội: số trận toàn giải + nhãn nguồn ("Thắng/Thua trận N").
 * Vòng 4–5 là dự kiến tương đối do luật trôi nhóm Swiss (xem .memory/knowledge/swiss-format.md).
 */
const ANTICIPATED_MATCHES: Record<number, Array<{ w: number; l: number; no: number; a: string; b: string }>> = {
  2: [
    { w: 1, l: 0, no: 5, a: "Thắng trận 1", b: "Thắng trận 2" },
    { w: 1, l: 0, no: 6, a: "Thắng trận 3", b: "Thắng trận 4" },
    { w: 0, l: 1, no: 7, a: "Thua trận 1", b: "Thua trận 2" },
    { w: 0, l: 1, no: 8, a: "Thua trận 3", b: "Thua trận 4" },
  ],
  3: [
    { w: 2, l: 0, no: 9, a: "Thắng trận 5", b: "Thắng trận 6" },
    { w: 1, l: 1, no: 10, a: "Thua trận 5", b: "Thắng trận 7" },
    { w: 1, l: 1, no: 11, a: "Thua trận 6", b: "Thắng trận 8" },
    { w: 0, l: 2, no: 12, a: "Thua trận 7", b: "Thua trận 8" },
  ],
  4: [
    { w: 2, l: 1, no: 13, a: "Thắng trận 10", b: "Thắng trận 11" },
    { w: 1, l: 2, no: 14, a: "Thua trận 10", b: "Thắng trận 12" },
    { w: 1, l: 2, no: 15, a: "Thua trận 11", b: "Thua trận 9" },
  ],
  5: [{ w: 2, l: 2, no: 16, a: "Thắng trận 14", b: "Thắng trận 15" }],
};

/**
 * The Board 1 Swiss stage: one column per round, each grouped by record. Record groups are
 * derived purely from standings (teams still alive whose total games played equals the
 * previous round count) — matches within a group come from the seeded schedule, and any
 * team in the group with no scheduled match that round shows up as an unpaired chip.
 */
export function computeSwissColumns(matches: IMatch[], records: TTeamRecords, teams: ITeam[]): ISwissColumn[] {
  const byId = buildById(teams);
  return ROUND_META.map((round: IRoundMeta) => {
    const roundMatches = matches.filter((m) => m.round === round.n);
    // Số trận toàn giải cho các trận thật: sắp theo sân rồi mã trận, bắt đầu từ ROUND_START.
    const start = ROUND_START[round.n] ?? 0;
    const ordered = [...roundMatches].sort((x, y) => x.court - y.court || x.id.localeCompare(y.id));
    const noById = new Map<string, number>(ordered.map((m, i) => [m.id, start + i]));
    const display = (m: IMatch) => matchDisplay(m, byId, noById.get(m.id) ?? 0);
    const groups: ISwissGroup[] = [];

    if (round.n === 1) {
      groups.push({
        label: "TẤT CẢ 8 ĐỘI · 0–0",
        sub: "Bốc thăm mở màn",
        bg: "#EEF3F7",
        border: "#B9CBD8",
        fg: "#2A5470",
        matches: roundMatches.map(display),
        chips: [],
        placeholders: [],
      });
    } else {
      const keys: string[] = [];
      teams.forEach((t) => {
        const r = records[t.id];
        if (!isAlive(records, t.id) || r.w + r.l !== round.n - 1) return;
        const key = `${r.w}-${r.l}`;
        if (!keys.includes(key)) keys.push(key);
      });
      keys.sort((x, y) => Number(y.split("-")[0]) - Number(x.split("-")[0]));

      keys.forEach((key) => {
        const [w, l] = key.split("-").map(Number);
        const ids = teams
          .filter((t) => records[t.id].w === w && records[t.id].l === l && isAlive(records, t.id))
          .map((t) => t.id);
        const groupMatches = roundMatches.filter((m) => ids.includes(m.a) && ids.includes(m.b));
        const paired: number[] = [];
        groupMatches.forEach((m) => paired.push(m.a, m.b));
        const style = groupStyle(w, l);
        groups.push({
          label: `NHÓM ${w}–${l}`,
          sub: `${ids.length} đội · thắng đi tiếp ${w + 1}–${l}`,
          ...style,
          matches: groupMatches.map(display),
          chips: ids.filter((id) => !paired.includes(id)).map((id) => teamChip(id, records, byId)),
          placeholders: [],
        });
      });

      if (groups.length === 0) {
        const bucketKeys: string[] = [];
        (ANTICIPATED_MATCHES[round.n] ?? []).forEach(({ w, l }) => {
          const k = `${w}-${l}`;
          if (!bucketKeys.includes(k)) bucketKeys.push(k);
        });
        bucketKeys.forEach((k) => {
          const [w, l] = k.split("-").map(Number);
          const style = groupStyle(w, l);
          groups.push({
            label: `NHÓM ${w}–${l}`,
            sub: "Dự kiến · ghép khi có kết quả vòng trước",
            ...style,
            matches: [],
            chips: [],
            placeholders: (ANTICIPATED_MATCHES[round.n] ?? [])
              .filter((e) => e.w === w && e.l === l)
              .map((e) => ({ no: e.no, aLabel: e.a, bLabel: e.b })),
          });
        });
      }
    }

    const { status, statusColor } = roundStatus(roundMatches);
    return {
      round: round.n,
      title: round.title,
      time: round.time,
      sub: round.sub,
      groups,
      status,
      statusColor,
    };
  });
}

/**
 * Board 2 semifinals. Resolves to the real `round_n=6` match rows (name + score + teamId) once
 * `ensurePlayoffs()` has inserted them; falls back to the Plan A seed-based placeholder (seed 1
 * vs seed 4, seed 2 vs seed 3, in qualification order) until then.
 */
export function computeSemis(qualified: ITeamChip[], matches: IMatch[], teams: ITeam[]): ISemiMatch[] {
  const byId = buildById(teams);
  const nameOf = (id: number) => (byId.get(id) ? `${byId.get(id)!.letter} · ${byId.get(id)!.name}` : "");

  const bk1 = matches.find((m) => m.round === 6 && m.court === 1);
  const bk2 = matches.find((m) => m.round === 6 && m.court === 2);
  if (bk1 && bk2) {
    return [
      { code: "BÁN KẾT 1", time: "SÂN 1", aName: nameOf(bk1.a), bName: nameOf(bk1.b), aTeamId: bk1.a, bTeamId: bk1.b },
      { code: "BÁN KẾT 2", time: "SÂN 2", aName: nameOf(bk2.a), bName: nameOf(bk2.b), aTeamId: bk2.a, bTeamId: bk2.b },
    ];
  }

  const seedName = (i: number) => (qualified[i] ? `${qualified[i].letter} · ${qualified[i].name}` : `Hạt giống #${i + 1}`);
  const seedTeamId = (i: number) => qualified[i]?.teamId ?? 0;
  return [
    {
      code: "BÁN KẾT 1",
      time: "11:30 · Sân 1",
      aName: seedName(0),
      bName: seedName(3),
      aTeamId: seedTeamId(0),
      bTeamId: seedTeamId(3),
    },
    {
      code: "BÁN KẾT 2",
      time: "11:30 · Sân 2",
      aName: seedName(1),
      bName: seedName(2),
      aTeamId: seedTeamId(1),
      bTeamId: seedTeamId(2),
    },
  ];
}

/**
 * Board 2 chung kết + tranh hạng 3. Resolves to the real `round_n=7` match rows once
 * `ensurePlayoffs()` has inserted them (linked to the semis by the round_n+court convention, see
 * `.memory/knowledge/swiss-format.md`); falls back to the Plan A static placeholder otherwise.
 * The round 7 rows are pre-resolved by `generateFinals` (Board 2 engine, `lib/tournament/
 * playoffs.ts`) at insert time — `aTeamId`/`bTeamId` there already ARE the winner/loser, so no
 * winner/loser derivation is needed here. This module deliberately does NOT import
 * `lib/tournament/playoffs.ts` (which imports this module) to avoid a cycle.
 */
export function computeFinals(
  semis: ISemiMatch[],
  matches: IMatch[],
  teams: ITeam[],
): { final: IFinalMatch; third: IFinalMatch } {
  const byId = buildById(teams);
  const nameOf = (id: number) => (byId.get(id) ? `${byId.get(id)!.letter} · ${byId.get(id)!.name}` : "");

  const ck = matches.find((m) => m.round === 7 && m.court === 1);
  const h3 = matches.find((m) => m.round === 7 && m.court === 2);

  const final: IFinalMatch = ck
    ? { code: "CHUNG KẾT", time: "SÂN 1", aName: nameOf(ck.a), bName: nameOf(ck.b), aTeamId: ck.a, bTeamId: ck.b }
    : {
        code: "CHUNG KẾT",
        time: "SÂN 1",
        aName: "Thắng Bán kết 1",
        bName: "Thắng Bán kết 2",
        aTeamId: 0,
        bTeamId: 0,
      };
  const third: IFinalMatch = h3
    ? { code: "TRANH HẠNG 3", time: "SÂN 2", aName: nameOf(h3.a), bName: nameOf(h3.b), aTeamId: h3.a, bTeamId: h3.b }
    : {
        code: "TRANH HẠNG 3",
        time: "SÂN 2",
        aName: "Thua Bán kết 1",
        bName: "Thua Bán kết 2",
        aTeamId: 0,
        bTeamId: 0,
      };

  return { final, third };
}

/** Per-round tracking table: one row per team, W/T-B history, and current status. */
export function computeTrackRows(records: TTeamRecords, teams: ITeam[]): ITrackRow[] {
  return teams.map((t) => {
    const r = records[t.id];
    const status =
      r.w >= 3
        ? { label: "Qualified", bg: "#E9F8EE", fg: "#1A6B3A" }
        : r.l >= 3
          ? { label: "Bị loại", bg: "#FBEAE7", fg: "#A3312B" }
          : { label: "Đang đấu", bg: "#F2F3F0", fg: "#5B7A72" };

    return {
      teamId: t.id,
      letter: t.letter,
      name: t.name,
      w: r.w,
      l: r.l,
      status: status.label,
      statusBg: status.bg,
      statusFg: status.fg,
      cells: [1, 2, 3, 4, 5].map((n) => {
        const v = r.hist[n];
        return {
          v: v ?? "–",
          color: v === "T" ? "#1F7A45" : v === "B" ? "#B5562B" : "#C4CAC6",
          weight: v ? "700" : "400",
        };
      }),
    };
  });
}
