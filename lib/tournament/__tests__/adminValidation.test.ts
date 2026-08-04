import { describe, expect, it } from "vitest";
import {
  validatePairAssignment,
  validatePlayerName,
  validateRosterComplete,
  validateTier,
} from "@/lib/tournament/adminValidation";

describe("validatePlayerName", () => {
  it("rejects empty and over-long, accepts normal", () => {
    expect(validatePlayerName("  ")).toMatch(/tên/i);
    expect(validatePlayerName("x".repeat(41))).toMatch(/dài/i);
    expect(validatePlayerName("Trúc")).toBeNull();
  });
});

describe("validateTier", () => {
  it("accepts 1-4 only", () => {
    expect(validateTier(1)).toBe(true);
    expect(validateTier(4)).toBe(true);
    expect(validateTier(0)).toBe(false);
    expect(validateTier(5)).toBe(false);
  });
});

describe("validatePairAssignment", () => {
  it("rejects empty or identical players", () => {
    expect(validatePairAssignment("", "b")).toMatch(/chọn/i);
    expect(validatePairAssignment("a", "a")).toMatch(/khác nhau/i);
    expect(validatePairAssignment("a", "b")).toBeNull();
  });
});

describe("validateRosterComplete", () => {
  const eightPairs = Array.from({ length: 8 }, (_, i) => ({ player1Id: `p${2 * i}`, player2Id: `p${2 * i + 1}` }));
  it("passes for 8 valid pairs + 16 players", () => {
    expect(validateRosterComplete(eightPairs, 16)).toBeNull();
  });
  it("fails when a pair is incomplete", () => {
    const bad = [...eightPairs.slice(1), { player1Id: "p0", player2Id: "" }];
    expect(validateRosterComplete(bad, 16)).toMatch(/cặp/i);
  });
});
