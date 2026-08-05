import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RulesPage from "../page";

describe("RulesPage", () => {
  it("renders the page heading, both section titles, and rule content", () => {
    render(<RulesPage />);

    expect(screen.getByText("Quy tắc thi đấu")).toBeInTheDocument();
    expect(screen.getByText("Thể thức Swiss-system")).toBeInTheDocument();
    expect(screen.getByText("Luật đánh cầu lông đôi")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Mỗi trận đấu Bo1 — một ván duy nhất, chạm 21 điểm trước và cách biệt tối thiểu 2 điểm để thắng."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "TRỌNG TÀI CÓ QUYỀN QUYẾT ĐỊNH CUỐI CÙNG TRONG MỌI TÌNH HUỐNG TRANH CHẤP."
      )
    ).toBeInTheDocument();
  });
});
