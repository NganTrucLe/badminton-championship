import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RewardsEditor } from "@/app/admin/RewardsEditor";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { mergeRewards, type IReward } from "@/lib/tournament/reward";

vi.mock("@/lib/supabase/browserClient", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

const rewards: IReward[] = [
  { place: 1, medal: "🏆", title: "Cúp vô địch + phần thưởng chính", detail: "Sẽ công bố 🎉" },
  { place: 2, medal: "🥈", title: "Huy chương bạc + phần thưởng", detail: "Sẽ công bố 🎉" },
  { place: 3, medal: "🥉", title: "Huy chương đồng + phần thưởng", detail: "Sẽ công bố 🎉" },
];

function mockSupabase(data: unknown[] | null = [{}]) {
  const update = vi.fn(() => ({
    eq: () => ({
      select: () => Promise.resolve({ data, error: null }),
    }),
  }));
  const from = vi.fn(() => ({ update }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedCreateBrowserSupabaseClient.mockReturnValue({ from } as any);
  return { update, from };
}

describe("RewardsEditor (characterization)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("edits a title, saves, and calls supabase update with mergeRewards output", async () => {
    const { update, from } = mockSupabase([{}]);
    const user = userEvent.setup();

    render(<RewardsEditor initialRewards={rewards} />);

    const titleInput = screen.getByDisplayValue("Cúp vô địch + phần thưởng chính");
    await user.clear(titleInput);
    await user.type(titleInput, "Cúp vô địch mới");

    await user.click(screen.getByRole("button", { name: /Lưu phần thưởng/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());

    expect(from).toHaveBeenCalledWith("tournament");
    const expectedPayload = mergeRewards([
      { ...rewards[0], title: "Cúp vô địch mới" },
      rewards[1],
      rewards[2],
    ]);
    expect(update).toHaveBeenCalledWith({ rewards: expectedPayload });

    await waitFor(() => expect(screen.getByText("Đã lưu phần thưởng.")).toBeInTheDocument());
  });

  it("shows 'Không có quyền quản trị.' when the update returns no rows", async () => {
    mockSupabase([]);
    const user = userEvent.setup();

    render(<RewardsEditor initialRewards={rewards} />);

    await user.click(screen.getByRole("button", { name: /Lưu phần thưởng/ }));

    await waitFor(() => expect(screen.getByText("Không có quyền quản trị.")).toBeInTheDocument());
  });
});
