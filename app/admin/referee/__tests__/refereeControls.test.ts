import { describe, expect, it } from "vitest";
import { isSelectable, matchWinnerSide, primaryAction, showScoreControls } from "../refereeControls";

describe("primaryAction", () => {
  it("returns 'start' for a next match", () => {
    expect(primaryAction("next")).toBe("start");
  });

  it("returns 'end' for a live match", () => {
    expect(primaryAction("live")).toBe("end");
  });

  it("returns 'none' for a done match", () => {
    expect(primaryAction("done")).toBe("none");
  });
});

describe("isSelectable", () => {
  it("allows selecting a 'next' match when nothing is live", () => {
    expect(isSelectable({ id: "M1", state: "next" }, undefined)).toBe(true);
  });

  it("does not allow selecting a 'done' match when nothing is live", () => {
    expect(isSelectable({ id: "M1", state: "done" }, undefined)).toBe(false);
  });

  it("allows selecting the live match itself", () => {
    expect(isSelectable({ id: "M2", state: "live" }, { id: "M2" })).toBe(true);
  });

  it("locks out a 'next' match when a different match is live", () => {
    expect(isSelectable({ id: "M1", state: "next" }, { id: "M2" })).toBe(false);
  });

  it("locks out a 'done' match when a different match is live", () => {
    expect(isSelectable({ id: "M3", state: "done" }, { id: "M2" })).toBe(false);
  });
});

describe("showScoreControls", () => {
  it("shows controls only when live", () => {
    expect(showScoreControls("live")).toBe(true);
    expect(showScoreControls("next")).toBe(false);
    expect(showScoreControls("done")).toBe(false);
  });
});

describe("matchWinnerSide", () => {
  it("returns 'a' when side A won a done match", () => {
    expect(matchWinnerSide("done", 21, 15)).toBe("a");
  });

  it("returns 'b' when side B won a done match", () => {
    expect(matchWinnerSide("done", 15, 21)).toBe("b");
  });

  it("returns null for a tied done match", () => {
    expect(matchWinnerSide("done", 21, 21)).toBeNull();
  });

  it("returns null for a live match regardless of score", () => {
    expect(matchWinnerSide("live", 21, 15)).toBeNull();
  });

  it("returns null for a next match regardless of score", () => {
    expect(matchWinnerSide("next", 21, 15)).toBeNull();
  });
});
