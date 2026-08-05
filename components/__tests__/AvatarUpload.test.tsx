import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AvatarUpload } from "@/components/AvatarUpload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

function mockSupabaseClient(uploadImpl: ReturnType<typeof vi.fn>) {
  mockedCreateBrowserSupabaseClient.mockReturnValue({
    storage: {
      from: () => ({
        upload: uploadImpl,
        getPublicUrl: () => ({
          data: { publicUrl: "https://x.supabase.co/storage/v1/object/public/avatars/p1.png" },
        }),
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe("AvatarUpload (characterization)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a valid image and calls onUploaded with a cache-busted URL", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient(upload);
    const onUploaded = vi.fn();

    const { container } = render(<AvatarUpload playerId="p1" currentUrl={null} onUploaded={onUploaded} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());

    expect(upload).toHaveBeenCalledWith("p1.png", file, { upsert: true, cacheControl: "3600" });

    const calledUrl = onUploaded.mock.calls[0][0] as string;
    expect(calledUrl.startsWith("https://x.supabase.co/storage/v1/object/public/avatars/p1.png")).toBe(true);
    expect(calledUrl).toContain("?v=");
  });

  it("rejects a non-image file with the Vietnamese error and never calls onUploaded", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient(upload);
    const onUploaded = vi.fn();

    const { container } = render(<AvatarUpload playerId="p1" currentUrl={null} onUploaded={onUploaded} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "a.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("Chỉ chấp nhận tệp ảnh.")).toBeInTheDocument());

    expect(onUploaded).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});
