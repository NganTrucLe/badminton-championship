import { describe, expect, it } from "vitest";
import { generateRoundOne } from "@/lib/tournament/roundOne";

describe("generateRoundOne", () => {
  it("pairs 8 codes adjacently after sorting: A–B, C–D, E–F, G–H", () => {
    const rows = generateRoundOne(["H", "A", "C", "B", "E", "D", "G", "F"]);
    expect(rows).toEqual([
      { code: "M1", court: 1, time: "09:00", aCode: "A", bCode: "B" },
      { code: "M2", court: 2, time: "09:00", aCode: "C", bCode: "D" },
      { code: "M3", court: 1, time: "09:20", aCode: "E", bCode: "F" },
      { code: "M4", court: 2, time: "09:20", aCode: "G", bCode: "H" },
    ]);
  });

  it("throws when there are not exactly 8 pair codes", () => {
    expect(() => generateRoundOne(["A", "B", "C"])).toThrow(/exactly 8 pairs/);
  });
});
