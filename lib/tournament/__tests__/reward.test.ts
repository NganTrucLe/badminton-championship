import { describe, expect, it } from "vitest";
import { DEFAULT_REWARDS, mergeRewards, parseRewards } from "@/lib/tournament/reward";

describe("parseRewards", () => {
  it("falls back to defaults on non-array input", () => {
    expect(parseRewards(null)).toEqual(DEFAULT_REWARDS);
    expect(parseRewards("nope")).toEqual(DEFAULT_REWARDS);
  });

  it("normalizes a valid array and sorts by place", () => {
    const raw = [
      { place: 2, medal: "🥈", title: "Nhì", detail: "x" },
      { place: 1, medal: "🏆", title: "Nhất", detail: "y" },
      { place: 3, medal: "🥉", title: "Ba", detail: "z" },
    ];
    expect(parseRewards(raw).map((r) => r.place)).toEqual([1, 2, 3]);
    expect(parseRewards(raw)[0].title).toBe("Nhất");
  });

  it("drops malformed entries and backfills from defaults", () => {
    const raw = [{ place: 1, title: "Chỉ tiêu đề" }];
    const out = parseRewards(raw);
    expect(out).toHaveLength(3);
    expect(out[0].title).toBe("Chỉ tiêu đề");
    expect(out[0].medal).toBe(DEFAULT_REWARDS[0].medal); // backfilled
  });
});

describe("mergeRewards", () => {
  it("always returns 3 sorted entries", () => {
    const out = mergeRewards([{ place: 1, title: "New champ" }]);
    expect(out).toHaveLength(3);
    expect(out[0].title).toBe("New champ");
    expect(out[1]).toEqual(DEFAULT_REWARDS[1]);
  });
});
