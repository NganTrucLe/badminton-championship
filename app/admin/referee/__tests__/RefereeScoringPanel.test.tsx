import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefereeScoringPanel } from "@/app/admin/referee/RefereeScoringPanel";
import { ensurePlayoffs } from "@/app/admin/referee/ensurePlayoffs";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { TEAMS, type IMatch } from "@/lib/tournament/data";

// The panel writes through the authenticated browser client — mock it so we can
// control the UPDATE result (success / zero-row RLS reject).
vi.mock("@/lib/supabase/browserClient", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

// useLiveMatches is a realtime hook returning a TUPLE [matches, setMatches].
// Keep `matches` fixed to the initial fixture; `setMatches` is a no-op spy so the
// optimistic value we assert on comes purely from the panel's local draft state.
vi.mock("@/lib/supabase/useLiveMatches", () => ({
  useLiveMatches: (initial: IMatch[]) => [initial, vi.fn()],
}));

// Avoid ensureNextRound's Supabase side effects on the commit("done") path.
vi.mock("@/app/admin/referee/ensureNextRound", () => ({
  ensureNextRound: vi.fn(),
}));

// Avoid ensurePlayoffs's Supabase side effects on the commit("done") path.
vi.mock("@/app/admin/referee/ensurePlayoffs", () => ({
  ensurePlayoffs: vi.fn(),
}));

const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

// ONE live match — auto-selected by the panel (locked to the live match), sa:5 sb:3.
const LIVE_MATCH: IMatch = {
  id: "M1",
  round: 1,
  court: 1,
  time: "09:00",
  a: 1,
  b: 2,
  sa: 5,
  sb: 3,
  state: "live",
};

function makeSupabase(updateResult: { data: unknown[]; error: unknown }) {
  const eq = vi.fn(() => ({ select: () => Promise.resolve(updateResult) }));
  const update = vi.fn(() => ({ eq }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedCreateBrowserSupabaseClient.mockReturnValue({ from: () => ({ update }) } as any);
  return { update, eq };
}

describe("RefereeScoringPanel (characterization: optimistic + rollback)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically increments the score and writes the update keyed by code", async () => {
    const { update, eq } = makeSupabase({ data: [{}], error: null });

    const user = userEvent.setup();
    render(<RefereeScoringPanel initialMatches={[LIVE_MATCH]} pairIdToTeamId={{}} teams={TEAMS} />);

    // Side A starts at its server-confirmed value (sa: 5).
    expect(screen.getByTestId("ref-score-a")).toHaveTextContent("5");

    await user.click(screen.getByRole("button", { name: "Tăng điểm đội A" }));

    // Optimistic: the display shows 6 immediately.
    expect(screen.getByTestId("ref-score-a")).toHaveTextContent("6");

    // The background write persists the new score, state stays "live".
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ score_a: 6, score_b: 3, state: "live" }),
    );
    expect(eq).toHaveBeenCalledWith("code", "M1");
  });

  it("ROLLS BACK to the last server value and shows the RLS message when the update matches zero rows", async () => {
    // Zero rows updated, no error → RLS silently filtered the row (non-organizer).
    makeSupabase({ data: [], error: null });

    const user = userEvent.setup();
    render(<RefereeScoringPanel initialMatches={[LIVE_MATCH]} pairIdToTeamId={{}} teams={TEAMS} />);

    await user.click(screen.getByRole("button", { name: "Tăng điểm đội A" }));

    // After the rejected write (zero rows), the draft rolls back to activeMatch.sa (5).
    // (The transient optimistic 6 is asserted in the success test; here the synchronous
    // mock resolves before we can observe it, and the observable outcome is the rollback.)
    await waitFor(() => expect(screen.getByTestId("ref-score-a")).toHaveTextContent("5"));
    expect(
      screen.getByText("Không thể lưu: tài khoản này không có quyền trọng tài."),
    ).toBeInTheDocument();
  });

  it("ends the match and shows the finished message on commit(\"done\")", async () => {
    makeSupabase({ data: [{}], error: null });

    const user = userEvent.setup();
    render(<RefereeScoringPanel initialMatches={[LIVE_MATCH]} pairIdToTeamId={{}} teams={TEAMS} />);

    await user.click(screen.getByRole("button", { name: /Kết thúc trận/i }));

    await waitFor(() =>
      expect(screen.getByText(/Đã kết thúc .* · 5–3/)).toBeInTheDocument(),
    );
    expect(ensurePlayoffs).toHaveBeenCalled();
  });
});
