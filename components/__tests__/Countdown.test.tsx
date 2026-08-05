import { render, screen } from "@testing-library/react";
import { Countdown } from "@/components/Countdown";

describe("Countdown", () => {
  it("renders all four tile labels", () => {
    render(<Countdown target="2026-08-15T00:00:00Z" />);

    expect(screen.getByText("NGÀY")).toBeInTheDocument();
    expect(screen.getByText("GIỜ")).toBeInTheDocument();
    expect(screen.getByText("PHÚT")).toBeInTheDocument();
    expect(screen.getByText("GIÂY")).toBeInTheDocument();
  });
});
