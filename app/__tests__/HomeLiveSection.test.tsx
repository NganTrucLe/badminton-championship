import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IMatch } from "@/lib/tournament/data";
import { getTeam, TEAMS } from "@/lib/tournament/data";
import { HomeLiveSection } from "../HomeLiveSection";

// Echo the seeded matches straight back — no Supabase Realtime in tests. computeLiveMatch /
// computeRecentResults stay REAL so this locks in that the restyle doesn't touch the data logic.
vi.mock("@/lib/supabase/useLiveMatches", () => ({
  useLiveMatches: (initial: IMatch[]) => [initial],
}));

const liveMatches: IMatch[] = [
  { id: "M1", round: 1, court: 1, time: "09:00", a: 1, b: 5, sa: 21, sb: 15, state: "done" },
  { id: "M2", round: 1, court: 2, time: "09:00", a: 2, b: 6, sa: 21, sb: 18, state: "done" },
  { id: "M5", round: 2, court: 1, time: "09:40", a: 1, b: 4, sa: 17, sb: 14, state: "live" },
];

// No live and no upcoming ('next') match — computeLiveMatch falls back to undefined, so the
// section renders only the recent-results card, no dark live card at all.
const noLiveMatches: IMatch[] = [
  { id: "M1", round: 1, court: 1, time: "09:00", a: 1, b: 5, sa: 21, sb: 15, state: "done" },
  { id: "M2", round: 1, court: 2, time: "09:00", a: 2, b: 6, sa: 21, sb: 18, state: "done" },
];

describe("HomeLiveSection", () => {
  it("renders the live match card with current teams, score, and the live label", () => {
    render(<HomeLiveSection initialMatches={liveMatches} pairIdToTeamId={{}} teams={TEAMS} />);

    expect(screen.getByText("ĐANG THI ĐẤU")).toBeInTheDocument();
    expect(screen.getByText("VÒNG 2 · SÂN 1")).toBeInTheDocument();
    expect(screen.getAllByText(getTeam(1).name).length).toBeGreaterThan(0);
    expect(screen.getByText(getTeam(4).name)).toBeInTheDocument();
    // Score is rendered as "17" <span>:</span> "14" (sibling text nodes) — match on the
    // container's combined text content rather than a single text node.
    expect(screen.getByText((_, node) => node?.textContent === "17:14")).toBeInTheDocument();

    // Recent results (only 'done' matches) still render alongside the live card.
    expect(screen.getByText("KẾT QUẢ GẦN NHẤT")).toBeInTheDocument();
    expect(screen.getByText("21 – 15")).toBeInTheDocument();
  });

  it("renders no live card and the empty recent-results state when nothing is live or upcoming", () => {
    render(<HomeLiveSection initialMatches={noLiveMatches} pairIdToTeamId={{}} teams={TEAMS} />);

    expect(screen.queryByText("ĐANG THI ĐẤU")).not.toBeInTheDocument();
    expect(screen.getByText("21 – 15")).toBeInTheDocument();
    expect(screen.getByText("21 – 18")).toBeInTheDocument();
  });

  it("renders the empty-results placeholder when there are no finished matches either", () => {
    const emptyMatches: IMatch[] = [{ id: "M6", round: 2, court: 2, time: "09:40", a: 2, b: 3, sa: 0, sb: 0, state: "next" }];
    render(<HomeLiveSection initialMatches={emptyMatches} pairIdToTeamId={{}} teams={TEAMS} />);

    expect(screen.getByText("Chưa có kết quả nào.")).toBeInTheDocument();
  });
});
