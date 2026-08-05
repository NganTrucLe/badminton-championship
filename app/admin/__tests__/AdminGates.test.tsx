import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { AdminSignedOut } from "@/app/admin/AdminSignedOut";
import { AdminDenied } from "@/app/admin/AdminDenied";

vi.mock("@/contexts/RefereeAuthContext", () => ({
  useRefereeAuth: vi.fn(),
}));

const mockUseRefereeAuth = vi.mocked(useRefereeAuth);

describe("AdminSignedOut", () => {
  it("calls signInWithGoogle('/admin') when the Google button is clicked", async () => {
    const signInWithGoogle = vi.fn();
    mockUseRefereeAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle,
      signOut: vi.fn(),
    });

    const user = userEvent.setup();
    render(<AdminSignedOut />);

    await user.click(screen.getByRole("button", { name: /Đăng nhập với Google/i }));

    expect(signInWithGoogle).toHaveBeenCalledWith("/admin");
  });
});

describe("AdminDenied", () => {
  it("shows the email and calls signOut when the sign-out button is clicked", async () => {
    const signOut = vi.fn();
    mockUseRefereeAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut,
    });

    const user = userEvent.setup();
    render(<AdminDenied email="x@y.com" />);

    expect(screen.getByText(/x@y.com/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Đăng xuất/i }));

    expect(signOut).toHaveBeenCalled();
  });
});
