import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayersEditor } from "@/app/admin/players/PlayersEditor";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import type { IAdminPlayer } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/browserClient", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

const player: IAdminPlayer = {
  id: "p1",
  name: "Old",
  tier: 1,
  gender: null,
  avatarKey: null,
  avatarUrl: null,
};

function mockSupabase() {
  const update = vi.fn(() => ({
    eq: () => ({
      select: () => Promise.resolve({ data: [{}], error: null }),
    }),
  }));
  const from = vi.fn(() => ({ update }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedCreateBrowserSupabaseClient.mockReturnValue({ from } as any);
  return { update, from };
}

describe("PlayersEditor (characterization)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("saves via the name input onBlur path when editable, calling patch's supabase update and applying the optimistic update", async () => {
    const { update } = mockSupabase();
    const user = userEvent.setup();

    render(<PlayersEditor initialPlayers={[player]} editable={true} />);

    const nameInput = screen.getByDisplayValue("Old");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.tab();

    await waitFor(() => expect(update).toHaveBeenCalledWith({ name: "New Name" }));

    expect(screen.getByDisplayValue("New Name")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Đã lưu.")).toBeInTheDocument());
  });

  it("disables all fields and shows the locked banner when not editable, and does not call update on blur", async () => {
    const { update } = mockSupabase();
    const user = userEvent.setup();

    render(<PlayersEditor initialPlayers={[player]} editable={false} />);

    expect(
      screen.getByText("Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa."),
    ).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Old");
    expect(nameInput).toBeDisabled();

    const selectTriggers = screen.getAllByRole("combobox");
    expect(selectTriggers).toHaveLength(2);
    selectTriggers.forEach((cb) => expect(cb).toBeDisabled());

    await user.click(nameInput);
    await user.tab();

    expect(update).not.toHaveBeenCalled();
  });
});
