import { describe, it, expect } from "vitest";
import { MATCHES, TEAMS, type IMatch, type ITeam } from "../data";
import {
  buildTeamRecords,
  computeStandingsTable,
  computeLiveMatch,
  computeRecentResults,
  computeQualified,
  computeEliminated,
  computeSwissColumns,
  computeSemis,
  computeSeeds,
  computeTrackRows,
} from "../standings";

describe("buildTeamRecords", () => {
  it("only counts done matches, ignoring live/next", () => {
    const records = buildTeamRecords(MATCHES, TEAMS);

    // Round 1 (all done): 1 beats 5, 2 beats 6, 3 beats 7, 4 beats 8.
    expect(records[1]).toMatchObject({ w: 1, l: 0 });
    expect(records[5]).toMatchObject({ w: 0, l: 1 });
    expect(records[2]).toMatchObject({ w: 1, l: 0 });
    expect(records[6]).toMatchObject({ w: 0, l: 1 });
    expect(records[3]).toMatchObject({ w: 1, l: 0 });
    expect(records[7]).toMatchObject({ w: 0, l: 1 });
    expect(records[4]).toMatchObject({ w: 1, l: 0 });
    expect(records[8]).toMatchObject({ w: 0, l: 1 });

    // M5 is 'live' and M6-M8 are 'next' -> must not affect records.
    expect(records[1].hist[2]).toBeUndefined();
    expect(records[4].hist[2]).toBeUndefined();
  });

  it("tracks points for/against and per-round win/loss history", () => {
    const records = buildTeamRecords(MATCHES, TEAMS);
    expect(records[1].pf).toBe(21);
    expect(records[1].pa).toBe(15);
    expect(records[1].hist[1]).toBe("T");
    expect(records[5].hist[1]).toBe("B");
  });

  it("seeds every team with a zeroed record even with no matches", () => {
    const records = buildTeamRecords([], TEAMS);
    expect(Object.keys(records)).toHaveLength(8);
    expect(records[1]).toMatchObject({ w: 0, l: 0, pf: 0, pa: 0 });
  });
});

describe("computeStandingsTable", () => {
  it("sorts by wins desc, then by team id asc, and colors top 4", () => {
    const records = buildTeamRecords(MATCHES, TEAMS);
    const table = computeStandingsTable(records, TEAMS);
    expect(table.map((r) => r.name)).toEqual([
      "Trung – Kiên",
      "Minh Anh – Bình",
      "Vinh – Trúc",
      "Vũ – Quang Hào",
      "Duy – Huy Nguyễn",
      "Tùng – Mỹ Hồ",
      "Nhân – Gái",
      "Phát – Hùng Bùi",
    ]);
    expect(table[0].rank).toBe("01");
    expect(table[0].rankColor).toBe("#0B5D4E");
    expect(table[4].rankColor).toBe("#B9C4C0");
  });
});

describe("computeLiveMatch", () => {
  it("prefers a live match over a next one", () => {
    const live = computeLiveMatch(MATCHES, TEAMS);
    expect(live).toBeDefined();
    expect(live!.aName).toBe("Trung – Kiên");
    expect(live!.bName).toBe("Vũ – Quang Hào");
    expect(live!.aScore).toBe(17);
    expect(live!.bScore).toBe(14);
    expect(live!.pct).toBe("81%");
  });

  it("falls back to the first 'next' match when nothing is live", () => {
    const noLive: IMatch[] = MATCHES.map((m) =>
      m.state === "live" ? { ...m, state: "done", sa: 21, sb: 14 } : m,
    );
    const live = computeLiveMatch(noLive, TEAMS);
    expect(live!.aName).toBe("Minh Anh – Bình");
    expect(live!.bName).toBe("Vinh – Trúc");
  });

  it("returns undefined when there are no matches at all", () => {
    expect(computeLiveMatch([], TEAMS)).toBeUndefined();
  });
});

describe("computeRecentResults", () => {
  it("returns the last 4 done matches, most recent first", () => {
    const recent = computeRecentResults(MATCHES, TEAMS);
    expect(recent).toHaveLength(4);
    expect(recent[0].code).toBe("M4");
    expect(recent[0].score).toBe("21 – 17");
    expect(recent[3].code).toBe("M1");
  });
});

describe("qualified / eliminated", () => {
  it("is empty when no team has reached 3 wins or 3 losses", () => {
    const records = buildTeamRecords(MATCHES, TEAMS);
    expect(computeQualified(records, TEAMS)).toEqual([]);
    expect(computeEliminated(records, TEAMS)).toEqual([]);
  });

  it("qualifies teams with >=3 wins and eliminates teams with >=3 losses", () => {
    const synthetic: IMatch[] = [
      { id: "S1", round: 1, court: 1, time: "09:00", a: 1, b: 2, sa: 21, sb: 10, state: "done" },
      { id: "S2", round: 2, court: 1, time: "09:20", a: 1, b: 3, sa: 21, sb: 10, state: "done" },
      { id: "S3", round: 3, court: 1, time: "09:40", a: 1, b: 4, sa: 21, sb: 10, state: "done" },
      { id: "S4", round: 1, court: 2, time: "09:00", a: 5, b: 2, sa: 21, sb: 10, state: "done" },
      { id: "S5", round: 2, court: 2, time: "09:20", a: 6, b: 2, sa: 21, sb: 10, state: "done" },
    ];
    const records = buildTeamRecords(synthetic, TEAMS);
    const qualified = computeQualified(records, TEAMS);
    const eliminated = computeEliminated(records, TEAMS);
    expect(qualified.map((c) => c.letter)).toEqual(["A"]);
    expect(eliminated.map((c) => c.letter)).toEqual(["B"]);
    expect(qualified[0].rec).toBe("3–0");
    expect(eliminated[0].rec).toBe("0–3");
  });
});

describe("computeSwissColumns", () => {
  it("groups round 1 as a single 'all teams' column with no record split", () => {
    const columns = computeSwissColumns(MATCHES, buildTeamRecords(MATCHES, TEAMS), TEAMS);
    const round1 = columns.find((c) => c.round === 1)!;
    expect(round1.groups).toHaveLength(1);
    expect(round1.groups[0].label).toBe("TẤT CẢ 8 ĐỘI · 0–0");
    expect(round1.groups[0].matches).toHaveLength(4);
    expect(round1.status).toBe("HOÀN TẤT");
  });

  it("groups round 2 by record (1-0 vs 0-1), pairing everyone with no leftover chips", () => {
    const columns = computeSwissColumns(MATCHES, buildTeamRecords(MATCHES, TEAMS), TEAMS);
    const round2 = columns.find((c) => c.round === 2)!;
    expect(round2.status).toBe("ĐANG DIỄN RA");
    expect(round2.groups.map((g) => g.label)).toEqual(["NHÓM 1–0", "NHÓM 0–1"]);
    expect(round2.groups[0].matches).toHaveLength(2);
    expect(round2.groups[0].chips).toEqual([]);
    expect(round2.groups[1].matches).toHaveLength(2);
  });

  it("shows a placeholder group for a round with no matches yet", () => {
    const columns = computeSwissColumns(MATCHES, buildTeamRecords(MATCHES, TEAMS), TEAMS);
    const round3 = columns.find((c) => c.round === 3)!;
    expect(round3.status).toBe("CHƯA BẮT ĐẦU");
    expect(round3.groups).toHaveLength(1);
    expect(round3.groups[0].label).toBe("CHỜ VÒNG TRƯỚC");
  });

  it("surfaces an unpaired team as a chip when a record group has an odd team out", () => {
    const oddOut: IMatch[] = [
      ...MATCHES,
      // Team 8 (0-1 after round 1) gets a round-2 match against an outsider (team 5,
      // also 0-1), leaving team 6/7 as an uneven leftover scenario is avoided by
      // instead removing team 7's round-2 match so it shows as an unpaired chip.
    ];
    const withoutM8: IMatch[] = oddOut.filter((m) => m.id !== "M8");
    const columns = computeSwissColumns(withoutM8, buildTeamRecords(withoutM8, TEAMS), TEAMS);
    const round2 = columns.find((c) => c.round === 2)!;
    const loseGroup = round2.groups.find((g) => g.label === "NHÓM 0–1")!;
    expect(loseGroup.chips.map((c) => c.letter)).toEqual(expect.arrayContaining(["F", "G"]));
  });
});

describe("computeSemis", () => {
  it("seeds 1v4 and 2v3 in qualification order, falling back to placeholder labels", () => {
    const noQualified = computeSemis([]);
    expect(noQualified[0].aName).toBe("Hạt giống #1");
    expect(noQualified[0].bName).toBe("Hạt giống #4");
    expect(noQualified[1].aName).toBe("Hạt giống #2");
    expect(noQualified[1].bName).toBe("Hạt giống #3");
  });

  it("uses the actual qualified teams, in order, once 4 have qualified", () => {
    const qualified = [
      { teamId: 1, letter: "A", name: "Team A", rec: "3–0" },
      { teamId: 2, letter: "B", name: "Team B", rec: "3–1" },
      { teamId: 3, letter: "C", name: "Team C", rec: "3–2" },
      { teamId: 4, letter: "D", name: "Team D", rec: "3–2" },
    ];
    const semis = computeSemis(qualified);
    expect(semis[0].aName).toBe("A · Team A");
    expect(semis[0].bName).toBe("D · Team D");
    expect(semis[1].aName).toBe("B · Team B");
    expect(semis[1].bName).toBe("C · Team C");
  });
});

describe("computeTrackRows", () => {
  it("marks a team's status as in-progress, qualified, or eliminated", () => {
    const records = buildTeamRecords(MATCHES, TEAMS);
    const rows = computeTrackRows(records, TEAMS);
    const teamA = rows.find((r) => r.letter === "A")!;
    expect(teamA.status).toBe("Đang đấu");
    expect(teamA.cells[0]).toMatchObject({ v: "T", color: "#1F7A45" });
    expect(teamA.cells[1]).toMatchObject({ v: "–", color: "#C4CAC6" });
  });

  it("marks qualified/eliminated status once a team hits 3 wins or 3 losses", () => {
    const synthetic: IMatch[] = [
      { id: "S1", round: 1, court: 1, time: "09:00", a: 1, b: 2, sa: 21, sb: 10, state: "done" },
      { id: "S2", round: 2, court: 1, time: "09:20", a: 1, b: 3, sa: 21, sb: 10, state: "done" },
      { id: "S3", round: 3, court: 1, time: "09:40", a: 1, b: 4, sa: 21, sb: 10, state: "done" },
    ];
    const rows = computeTrackRows(buildTeamRecords(synthetic, TEAMS), TEAMS);
    expect(rows.find((r) => r.letter === "A")!.status).toBe("Qualified");
  });
});

describe("live team names", () => {
  it("flows a renamed/edited team through computeRecentResults and computeSwissColumns instead of the static seed", () => {
    const renamedTeams: ITeam[] = TEAMS.map((t) =>
      t.id === 1 ? { ...t, name: "X – Y", players: [{ name: "X", tier: 1 }, { name: "Y", tier: 4 }] } : t,
    );

    const recent = computeRecentResults(MATCHES, renamedTeams);
    const m1 = recent.find((r) => r.code === "M1")!;
    expect(m1.aName).toBe("X – Y");
    expect(m1.aName).not.toBe("Trung – Kiên");

    const records = buildTeamRecords(MATCHES, renamedTeams);
    const columns = computeSwissColumns(MATCHES, records, renamedTeams);
    const round1 = columns.find((c) => c.round === 1)!;
    const m1Display = round1.groups[0].matches.find((m) => m.code === "M1")!;
    expect(m1Display.aName).toBe("X – Y");
  });
});

describe("computeSeeds", () => {
  const teams = TEAMS;
  const done = (id: string, r: number, a: number, b: number, sa: number, sb: number): IMatch => ({
    id,
    round: r,
    court: 1,
    time: "",
    a,
    b,
    sa,
    sb,
    state: "done",
  });
  // 4 đội qualified (1,2,3,4) đều 3 thắng.
  // team1: diff +47 (cao nhất). team4: diff +16 (thấp nhất).
  // team2 & team3: cùng diff +30 — nhưng team3 thắng team2 đối đầu trực tiếp (H23) nên xếp trên.
  const matches: IMatch[] = [
    // Round 1
    done("W1", 1, 1, 5, 21, 3),
    done("W4", 1, 4, 8, 21, 15),
    done("W7", 1, 2, 6, 21, 9),
    done("W10", 1, 3, 7, 21, 9),
    // Round 2
    done("W2", 2, 1, 6, 21, 5),
    done("W5", 2, 4, 7, 21, 16),
    done("W8", 2, 2, 5, 21, 9),
    done("W11", 2, 3, 8, 21, 9),
    // Round 3
    done("W3", 3, 1, 7, 21, 8),
    done("W6", 3, 4, 5, 21, 16),
    done("H23", 3, 3, 2, 21, 15),
    // Round 4
    done("W9", 4, 2, 8, 21, 9),
  ];

  it("chỉ trả đội đủ 3 thắng, đúng thứ tự seed (thắng→hiệu số→đối đầu)", () => {
    const records = buildTeamRecords(matches, teams);
    const seeds = computeSeeds(matches, records, teams);
    expect(seeds.map((s) => s.teamId)).toEqual([1, 3, 2, 4]);
  });

  it("đối đầu phá hòa khi hiệu số bằng nhau", () => {
    const records = buildTeamRecords(matches, teams);
    // team2 và team3 có cùng hiệu số (+30); team3 thắng trực tiếp (H23) => team3 trên team2.
    const seeds = computeSeeds(matches, records, teams);
    const i2 = seeds.findIndex((s) => s.teamId === 2);
    const i3 = seeds.findIndex((s) => s.teamId === 3);
    expect(i3).toBeLessThan(i2);
  });
});
