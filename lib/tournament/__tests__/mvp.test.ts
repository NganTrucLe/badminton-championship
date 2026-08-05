import { describe, expect, it } from "vitest";
import {
  computeWinners,
  effectiveStatus,
  groupCandidatesByGender,
  isResultsVisible,
  tallyBallots,
  type IMvpCandidate,
} from "@/lib/tournament/mvp";

const cand = (id: string, gender: "male" | "female", name: string): IMvpCandidate => ({
  id, name, gender, tier: 1, avatarKey: null, avatarUrl: null,
});

const m1 = cand("m1", "male", "Alan");
const m2 = cand("m2", "male", "Bob");
const f1 = cand("f1", "female", "Cara");
const f2 = cand("f2", "female", "Dana");

describe("effectiveStatus", () => {
  const now = new Date("2026-08-05T10:00:00Z");
  it("returns idle/closed unchanged", () => {
    expect(effectiveStatus("idle", null, now)).toBe("idle");
    expect(effectiveStatus("closed", null, now)).toBe("closed");
  });
  it("keeps open before the deadline", () => {
    expect(effectiveStatus("open", "2026-08-05T10:05:00Z", now)).toBe("open");
  });
  it("collapses open past the deadline to closed", () => {
    expect(effectiveStatus("open", "2026-08-05T09:59:00Z", now)).toBe("closed");
  });
});

describe("isResultsVisible", () => {
  it("is true only when closed", () => {
    expect(isResultsVisible("closed")).toBe(true);
    expect(isResultsVisible("open")).toBe(false);
    expect(isResultsVisible("idle")).toBe(false);
  });
});

describe("groupCandidatesByGender", () => {
  it("splits and preserves order", () => {
    const g = groupCandidatesByGender([m1, f1, m2, f2]);
    expect(g.male.map((c) => c.id)).toEqual(["m1", "m2"]);
    expect(g.female.map((c) => c.id)).toEqual(["f1", "f2"]);
  });
});

describe("tallyBallots", () => {
  const candidates = [m1, m2, f1, f2];
  const rows = [
    { gender: "male" as const, candidateId: "m1", votes: 3 },
    { gender: "male" as const, candidateId: "m2", votes: 1 },
    { gender: "female" as const, candidateId: "f2", votes: 2 },
  ];
  it("sorts each gender by votes desc then name asc and joins candidate data", () => {
    const r = tallyBallots(candidates, rows);
    expect(r.male.tallies.map((t) => [t.candidate.id, t.votes])).toEqual([["m1", 3], ["m2", 1]]);
    expect(r.male.winners.map((c) => c.id)).toEqual(["m1"]);
    expect(r.female.tallies.map((t) => [t.candidate.id, t.votes])).toEqual([["f2", 2], ["f1", 0]]);
    expect(r.female.winners.map((c) => c.id)).toEqual(["f2"]);
  });
  it("returns no winners when nobody has votes", () => {
    const r = tallyBallots(candidates, []);
    expect(r.male.winners).toEqual([]);
    expect(r.female.winners).toEqual([]);
  });
});

describe("computeWinners", () => {
  it("returns all candidates tied at the max (>0)", () => {
    const tallies = [
      { candidate: m1, votes: 2 },
      { candidate: m2, votes: 2 },
    ];
    expect(computeWinners(tallies).map((c) => c.id)).toEqual(["m1", "m2"]);
  });
  it("returns empty when max is zero", () => {
    expect(computeWinners([{ candidate: m1, votes: 0 }])).toEqual([]);
  });
});
