import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IMatch } from "@/lib/tournament/data";
import { getTeam, MATCHES, TEAMS } from "@/lib/tournament/data";
import { ScheduleBoard } from "../ScheduleBoard";

// Echo the seeded matches straight back — no Supabase Realtime in tests. Standings + getTeam stay
// REAL, so this locks that the board renders every derived view (Swiss cols, qualified/eliminated,
// semis, tracking table) without crashing. The Swiss maths themselves are covered by standings.ts's
// own unit tests, so we only assert structural, restyle-surviving content here.
vi.mock("@/lib/supabase/useLiveMatches", () => ({
  useLiveMatches: (initial: IMatch[]) => [initial],
}));

// A small but valid schedule referencing teams 1..8 (all resolvable via getTeam). Round 1 is fully
// played so several teams have a win/loss on record; round 2 mixes a live + upcoming match.
const initialMatches: IMatch[] = [
  { id: "M1", round: 1, court: 1, time: "09:00", a: 1, b: 5, sa: 21, sb: 15, state: "done" },
  { id: "M2", round: 1, court: 2, time: "09:00", a: 2, b: 6, sa: 21, sb: 18, state: "done" },
  { id: "M3", round: 1, court: 1, time: "09:20", a: 3, b: 7, sa: 21, sb: 19, state: "done" },
  { id: "M4", round: 1, court: 2, time: "09:20", a: 4, b: 8, sa: 21, sb: 17, state: "done" },
  { id: "M5", round: 2, court: 1, time: "09:40", a: 1, b: 4, sa: 17, sb: 14, state: "live" },
  { id: "M6", round: 2, court: 2, time: "09:40", a: 2, b: 3, sa: 0, sb: 0, state: "next" },
];

describe("ScheduleBoard", () => {
  it("renders the board sections, a resolved team name, and the tracking table", () => {
    render(<ScheduleBoard initialMatches={initialMatches} pairIdToTeamId={{}} teams={TEAMS} />);

    // The three board sections all render (VERBATIM Vietnamese labels).
    expect(screen.getByText("BOARD 1 · SWISS STAGE")).toBeInTheDocument();
    expect(screen.getByText("BOARD 2 · PLAYOFFS (4 ĐỘI QUALIFIED)")).toBeInTheDocument();
    expect(screen.getByText("BẢNG THEO DÕI THEO VÒNG")).toBeInTheDocument();

    // A real team name resolved via getTeam appears (team 1 plays in round 1 + the tracking table).
    const teamOne = getTeam(1).name;
    expect(screen.getAllByText(teamOne).length).toBeGreaterThan(0);

    // The per-round tracking grid renders as a real table with header labels + status column.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("ĐỘI")).toBeInTheDocument();
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("R5")).toBeInTheDocument();
    expect(screen.getByText("TRẠNG THÁI")).toBeInTheDocument();
  });

  it("renders the Swiss qualified/eliminated result columns", () => {
    render(<ScheduleBoard initialMatches={initialMatches} pairIdToTeamId={{}} teams={TEAMS} />);

    expect(screen.getByText("Kết quả Swiss")).toBeInTheDocument();
    expect(screen.getByText("QUALIFIED · 3 THẮNG")).toBeInTheDocument();
    expect(screen.getByText("ELIMINATED · 3 THUA")).toBeInTheDocument();
  });

  it("hiện dòng placeholder cho vòng Swiss dự kiến và cụm Chung kết", () => {
    const pairIdToTeamId = Object.fromEntries(TEAMS.map((t) => [String(t.id), t.id]));
    render(<ScheduleBoard initialMatches={MATCHES} pairIdToTeamId={pairIdToTeamId} teams={TEAMS} />);
    expect(screen.getAllByText(/Chờ đội/i).length).toBeGreaterThan(0);
    expect(screen.getByText("CHUNG KẾT")).toBeInTheDocument();
  });
});
