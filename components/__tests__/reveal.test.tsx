import { render, screen } from "@testing-library/react";
import { Reveal } from "@/components/motion";

describe("Reveal", () => {
  it("renders its children", () => {
    render(
      <Reveal>
        <span>hello</span>
      </Reveal>,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
