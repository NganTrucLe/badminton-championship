/**
 * Pure standings / Swiss-board computation, ported from the `renderVals()` method of the
 * design prototype's `Component extends DCLogic` class in
 * `.design-reference/Giai Cau Long CLB.dc.html`.
 *
 * Deliberately framework-free (no React) so it is directly unit-testable and usable from
 * both server and client components.
 */

import {
  TEAMS,
  ROUND_META,
  getTeam,
  teamName,
  teamPlayersLabel,
  type IMatch,
  type IRoundMeta,
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

/** Builds a per-team W/L/points-for/points-against record, counting only 'done' matches. */
export function buildTeamRecords(matches: IMatch[]): TTeamRecords {
  const table: TTeamRecords = {};
  TEAMS.forEach((t) => {
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

export function computeStandingsTable(records: TTeamRecords): IStandingsRow[] {
  return Object.values(records)
    .sort((x, y) => y.w - x.w || x.id - y.id)
    .map((r, i) => ({
      rank: pad2(i + 1),
      rankColor: i < 4 ? "#0B5D4E" : "#B9C4C0",
      name: teamName(r.id),
      players: teamPlayersLabel(r.id),
      w: r.w,
      l: r.l,
    }));
}

/** The current live match, or the first upcoming ('next') match if nothing is live. */
export function computeLiveMatch(matches: IMatch[]): ILiveMatchInfo | undefined {
  const liveMatch = matches.find((m) => m.state === "live") ?? matches.find((m) => m.state === "next");
  if (!liveMatch) return undefined;

  return {
    round: "VÒNG " + liveMatch.round,
    court: liveMatch.court,
    aName: teamName(liveMatch.a),
    bName: teamName(liveMatch.b),
    aPlayers: teamPlayersLabel(liveMatch.a),
    bPlayers: teamPlayersLabel(liveMatch.b),
    aScore: liveMatch.sa,
    bScore: liveMatch.sb,
    pct: Math.min(100, Math.round((Math.max(liveMatch.sa, liveMatch.sb) / 21) * 100)) + "%",
  };
}

/** The most recent 4 finished matches, newest first. */
export function computeRecentResults(matches: IMatch[]): IRecentResult[] {
  return matches
    .filter((m) => m.state === "done")
    .slice(-4)
    .reverse()
    .map((m) => ({
      code: m.id,
      aName: teamName(m.a),
      bName: teamName(m.b),
      score: `${m.sa} – ${m.sb}`,
    }));
}

function teamChip(id: number, records: TTeamRecords): ITeamChip {
  const team = getTeam(id);
  const r = records[id];
  return { teamId: id, letter: team.letter, name: team.name, rec: `${r.w}–${r.l}` };
}

/** Teams that have reached 3 wins (advance to Board 2 / playoffs). */
export function computeQualified(records: TTeamRecords): ITeamChip[] {
  return TEAMS.filter((t) => records[t.id].w >= 3).map((t) => teamChip(t.id, records));
}

/** Teams that have reached 3 losses (eliminated from the Swiss stage). */
export function computeEliminated(records: TTeamRecords): ITeamChip[] {
  return TEAMS.filter((t) => records[t.id].l >= 3).map((t) => teamChip(t.id, records));
}

function isAlive(records: TTeamRecords, id: number): boolean {
  return records[id].w < 3 && records[id].l < 3;
}

function matchDisplay(m: IMatch): ISwissMatchDisplay {
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
    meta: `${m.time} · Sân ${m.court}`,
    state: meta.label,
    stateColor: meta.color,
    aTeamId: m.a,
    bTeamId: m.b,
    aName: teamName(m.a),
    bName: teamName(m.b),
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

/**
 * The Board 1 Swiss stage: one column per round, each grouped by record. Record groups are
 * derived purely from standings (teams still alive whose total games played equals the
 * previous round count) — matches within a group come from the seeded schedule, and any
 * team in the group with no scheduled match that round shows up as an unpaired chip.
 */
export function computeSwissColumns(matches: IMatch[], records: TTeamRecords): ISwissColumn[] {
  return ROUND_META.map((round: IRoundMeta) => {
    const roundMatches = matches.filter((m) => m.round === round.n);
    const groups: ISwissGroup[] = [];

    if (round.n === 1) {
      groups.push({
        label: "TẤT CẢ 8 ĐỘI · 0–0",
        sub: "Bốc thăm mở màn",
        bg: "#EEF3F7",
        border: "#B9CBD8",
        fg: "#2A5470",
        matches: roundMatches.map(matchDisplay),
        chips: [],
      });
    } else {
      const keys: string[] = [];
      TEAMS.forEach((t) => {
        const r = records[t.id];
        if (!isAlive(records, t.id) || r.w + r.l !== round.n - 1) return;
        const key = `${r.w}-${r.l}`;
        if (!keys.includes(key)) keys.push(key);
      });
      keys.sort((x, y) => Number(y.split("-")[0]) - Number(x.split("-")[0]));

      keys.forEach((key) => {
        const [w, l] = key.split("-").map(Number);
        const ids = TEAMS.filter(
          (t) => records[t.id].w === w && records[t.id].l === l && isAlive(records, t.id),
        ).map((t) => t.id);
        const groupMatches = roundMatches.filter((m) => ids.includes(m.a) && ids.includes(m.b));
        const paired: number[] = [];
        groupMatches.forEach((m) => paired.push(m.a, m.b));
        const style = groupStyle(w, l);
        groups.push({
          label: `NHÓM ${w}–${l}`,
          sub: `${ids.length} đội · thắng đi tiếp ${w + 1}–${l}`,
          ...style,
          matches: groupMatches.map(matchDisplay),
          chips: ids.filter((id) => !paired.includes(id)).map((id) => teamChip(id, records)),
        });
      });

      if (groups.length === 0) {
        groups.push({
          label: "CHỜ VÒNG TRƯỚC",
          sub: "Ghép cặp khi có đủ kết quả",
          bg: "#F4F4F1",
          border: "#DEDED7",
          fg: "#8AA39C",
          matches: [],
          chips: [],
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

/** Board 2 semifinal seeding: seed 1 vs seed 4, seed 2 vs seed 3, in qualification order. */
export function computeSemis(qualified: ITeamChip[]): ISemiMatch[] {
  const seedName = (i: number) => (qualified[i] ? `${qualified[i].letter} · ${qualified[i].name}` : `Hạt giống #${i + 1}`);
  return [
    { code: "BÁN KẾT 1", time: "11:30 · Sân 1", aName: seedName(0), bName: seedName(3) },
    { code: "BÁN KẾT 2", time: "11:30 · Sân 2", aName: seedName(1), bName: seedName(2) },
  ];
}

/** Per-round tracking table: one row per team, W/T-B history, and current status. */
export function computeTrackRows(records: TTeamRecords): ITrackRow[] {
  return TEAMS.map((t) => {
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
