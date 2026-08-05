import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LifecyclePanel } from "@/app/admin/LifecyclePanel";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

describe("LifecyclePanel (characterization)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls the start_tournament RPC when the start button is clicked", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedCreateBrowserSupabaseClient.mockReturnValue({ rpc } as any);

    const user = userEvent.setup();
    render(<LifecyclePanel initialStatus="setup" rosterError={null} />);

    await user.click(screen.getByRole("button", { name: /Gửi đội hình & bắt đầu giải/i }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("start_tournament"));
  });

  it("requires opening the AlertDialog and confirming before calling reset_tournament", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedCreateBrowserSupabaseClient.mockReturnValue({ rpc } as any);

    const user = userEvent.setup();
    render(<LifecyclePanel initialStatus="setup" rosterError={null} />);

    expect(rpc).not.toHaveBeenCalledWith("reset_tournament");

    await user.click(screen.getByRole("button", { name: /Đặt lại giải đấu…/i }));

    const confirmButton = await screen.findByRole("button", {
      name: /Xác nhận đặt lại — không thể hoàn tác/i,
    });
    expect(rpc).not.toHaveBeenCalledWith("reset_tournament");

    await user.click(confirmButton);

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("reset_tournament"));
  });

  it("disables the start button when rosterError is set", () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedCreateBrowserSupabaseClient.mockReturnValue({ rpc } as any);

    render(<LifecyclePanel initialStatus="setup" rosterError="Thiếu cặp đấu" />);

    expect(screen.getByRole("button", { name: /Gửi đội hình & bắt đầu giải/i })).toBeDisabled();
  });
});
