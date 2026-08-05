import { render, screen } from "@testing-library/react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { IPlayer } from "@/lib/tournament/data";

// Player with no avatarKey/avatarUrl -> avatarPhotoPath() returns undefined ->
// the fallback initials circle renders directly (no image, no jsdom load-event
// timing issues either way).
const player: IPlayer = { name: "Minh Anh", tier: 2 };

describe("PlayerAvatar", () => {
  it("shows the single-letter initial fallback (initials='single', default)", () => {
    render(<PlayerAvatar player={player} size={48} />);
    // playerInitial("Minh Anh") -> "M"
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows the two-letter initials fallback (initials='double')", () => {
    render(<PlayerAvatar player={player} size={48} initials="double" />);
    // playerInitials("Minh Anh") -> "MA"
    expect(screen.getByText("MA")).toBeInTheDocument();
  });
});
