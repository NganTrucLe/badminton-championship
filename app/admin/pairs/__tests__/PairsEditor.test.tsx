import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PairsEditor } from "@/app/admin/pairs/PairsEditor";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import type { IAdminPair, IAdminPlayer } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/browserClient", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

const players: IAdminPlayer[] = [
  { id: "p1", name: "An", tier: 1, avatarKey: null, avatarUrl: null },
  { id: "p2", name: "Bình", tier: 1, avatarKey: null, avatarUrl: null },
];

const pair: IAdminPair = {
  id: "pair-1",
  code: "P1",
  name: "Old",
  player1Id: "p1",
  player2Id: "p2",
};

function mockSupabase() {
  const update = vi.fn(() => ({
    eq: () => ({
      select: () => Promise.resolve({ data: [{ id: pair.id }], error: null }),
    }),
  }));
  const from = vi.fn(() => ({ update }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedCreateBrowserSupabaseClient.mockReturnValue({ from } as any);
  return { update, from };
}

describe("PairsEditor (characterization)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("saves via the name input onBlur path when editable, calling savePair's supabase update", async () => {
    const { update, from } = mockSupabase();
    const user = userEvent.setup();

    render(<PairsEditor initialPairs={[pair]} players={players} editable={true} />);

    const nameInput = screen.getByDisplayValue("Old");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.tab();

    await waitFor(() => expect(update).toHaveBeenCalled());

    expect(from).toHaveBeenCalledWith("pairs");
    expect(update).toHaveBeenCalledWith({
      player1_id: "p1",
      player2_id: "p2",
      name: "New Name",
    });

    await waitFor(() => expect(screen.getByText(`Đã lưu cặp ${pair.code}.`)).toBeInTheDocument());
  });

  it("disables all fields and shows the locked banner when not editable, and does not call update on blur", async () => {
    const { update } = mockSupabase();
    const user = userEvent.setup();

    render(<PairsEditor initialPairs={[pair]} players={players} editable={false} />);

    expect(
      screen.getByText("Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa."),
    ).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Old");
    expect(nameInput).toBeDisabled();

    const selectTriggers = screen.getAllByRole("combobox");
    expect(selectTriggers.length).toBeGreaterThan(0);
    selectTriggers.forEach((trigger) => expect(trigger).toBeDisabled());

    await user.click(nameInput);
    await user.tab();

    expect(update).not.toHaveBeenCalled();
  });
});
