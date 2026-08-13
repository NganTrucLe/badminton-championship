import { render, screen } from "@testing-library/react";
import { RefereePlayoffPicker } from "@/app/admin/referee/RefereePlayoffPicker";
import { TEAMS, type IMatch } from "@/lib/tournament/data";
import { TeamLookupProvider } from "@/lib/tournament/teamLookup";

const semis: IMatch[] = [
  { id: "R6-1", round: 6, court: 1, time: "", a: 1, b: 4, sa: 0, sb: 0, state: "next" },
  { id: "R6-2", round: 6, court: 2, time: "", a: 2, b: 3, sa: 0, sb: 0, state: "next" },
];

describe("RefereePlayoffPicker", () => {
  it("hiện các trận bán kết để chọn", () => {
    render(
      <TeamLookupProvider teams={TEAMS}>
        <RefereePlayoffPicker matches={semis} activeId="" liveMatchId={null} onSelect={() => {}} />
      </TeamLookupProvider>,
    );
    expect(screen.getByText(/Bán kết 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Bán kết 2/i)).toBeInTheDocument();
  });

  it("không render gì khi không có trận playoff", () => {
    const { container } = render(
      <TeamLookupProvider teams={TEAMS}>
        <RefereePlayoffPicker matches={[]} activeId="" liveMatchId={null} onSelect={() => {}} />
      </TeamLookupProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
