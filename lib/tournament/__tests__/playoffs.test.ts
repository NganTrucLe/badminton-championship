import { describe, it, expect } from "vitest";
import { TEAMS, type IMatch } from "../data";
import { qualifiedSeedIds, generateSemis, generateFinals, winnerOf, loserOf } from "../playoffs";

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
// 4 đội (1,2,3,4) đủ 3 thắng với hiệu số giảm dần 1>2>3>4.
const fourQualified: IMatch[] = [
  done("a1", 1, 1, 5, 21, 1),
  done("a2", 2, 1, 6, 21, 2),
  done("a3", 3, 1, 7, 21, 3),
  done("b1", 1, 2, 6, 21, 5),
  done("b2", 2, 2, 7, 21, 6),
  done("b3", 3, 2, 8, 21, 7),
  done("c1", 1, 3, 7, 21, 10),
  done("c2", 2, 3, 8, 21, 11),
  done("c3", 3, 3, 5, 21, 12),
  done("d1", 1, 4, 8, 21, 14),
  done("d2", 2, 4, 5, 21, 15),
  done("d3", 3, 4, 6, 21, 16),
];

describe("qualifiedSeedIds", () => {
  it("trả 4 đội đủ 3 thắng theo thứ tự seed hiệu số giảm dần", () => {
    expect(qualifiedSeedIds(fourQualified, TEAMS)).toEqual([1, 2, 3, 4]);
  });
  it("trả rỗng khi chưa đủ 4 đội qualified", () => {
    expect(qualifiedSeedIds([done("x", 1, 1, 2, 21, 5)], TEAMS)).toEqual([]);
  });
});

describe("generateSemis", () => {
  it("sinh 2 bán kết: sân1 seed1×seed4, sân2 seed2×seed3", () => {
    const rows = generateSemis(fourQualified, TEAMS)!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ round: 6, court: 1, aTeamId: 1, bTeamId: 4, code: "R6-1" });
    expect(rows[1]).toMatchObject({ round: 6, court: 2, aTeamId: 2, bTeamId: 3, code: "R6-2" });
  });
  it("null khi chưa đủ 4 qualified", () => {
    expect(generateSemis([done("x", 1, 1, 2, 21, 5)], TEAMS)).toBeNull();
  });
  it("null khi đã tồn tại round 6 (idempotent)", () => {
    const withSemis = [...fourQualified, done("R6-1", 6, 1, 4, 21, 10)];
    expect(generateSemis(withSemis, TEAMS)).toBeNull();
  });
});

describe("winnerOf / loserOf", () => {
  const m = done("R6-1", 6, 1, 4, 21, 15);
  it("winner = đội điểm cao, loser = đội điểm thấp", () => {
    expect(winnerOf(m)).toBe(1);
    expect(loserOf(m)).toBe(4);
  });
  it("null khi trận chưa done", () => {
    expect(winnerOf({ ...m, state: "live" })).toBeNull();
  });
});

describe("generateFinals", () => {
  const base = [
    ...fourQualified,
    done("R6-1", 6, 1, 4, 21, 10), // BK1: đội1 thắng đội4
    { ...done("R6-2", 6, 2, 3, 21, 12), court: 2 }, // BK2: đội2 thắng đội3
  ];
  it("chung kết = thắng BK1 vs thắng BK2, hạng 3 = thua vs thua", () => {
    const rows = generateFinals(base)!;
    expect(rows[0]).toMatchObject({ round: 7, court: 1, aTeamId: 1, bTeamId: 2 });
    expect(rows[1]).toMatchObject({ round: 7, court: 2, aTeamId: 4, bTeamId: 3 });
  });
  it("null khi một bán kết chưa done", () => {
    const notDone = base.map((m) => (m.id === "R6-2" ? { ...m, state: "live" as const } : m));
    expect(generateFinals(notDone)).toBeNull();
  });
});
