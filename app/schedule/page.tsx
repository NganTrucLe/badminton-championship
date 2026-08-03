import { getMatches, getPairIdToTeamId } from "@/lib/supabase/tournament";
import { ScheduleBoard } from "./ScheduleBoard";

// Read fresh from Supabase on every request for a correct first paint — the Swiss board,
// playoffs, and tracking table then hydrate into a client island (ScheduleBoard) that stays live
// via Supabase Realtime, so scores update without a reload after the initial SSR.
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 20px 60px" }}>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-bricolage), Archivo, sans-serif",
          fontSize: "clamp(30px,4.6vw,52px)",
          fontWeight: 900,
          letterSpacing: "-.035em",
        }}
      >
        Lịch &amp; bảng đấu
      </h2>
      <p style={{ margin: "10px 0 0", maxWidth: 640, fontSize: 15, lineHeight: 1.6, color: "#3C5A53" }}>
        Thể thức <strong>Swiss-system</strong> theo chuẩn esport, mỗi trận <strong>Bo1</strong> (1 ván tới 21). Sau
        mỗi vòng, các đội cùng thành tích được ghép với nhau. Thắng đủ <strong>3 trận</strong> → vào playoffs. Thua
        đủ <strong>3 trận</strong> → dừng bước. Tối đa 5 vòng, 2 sân chạy song song.
      </p>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#EEF7F1",
            border: "1px solid #A8D3BB",
            borderRadius: 999,
            padding: "7px 14px",
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#1F7A45" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1F7A45" }}>Nhóm thắng nhiều hơn</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FFF9EC",
            border: "1px solid #EBD7A4",
            borderRadius: 999,
            padding: "7px 14px",
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#A3790A" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#A3790A" }}>Nhóm cân bằng</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FBEFE7",
            border: "1px solid #E6C0A4",
            borderRadius: 999,
            padding: "7px 14px",
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#B5562B" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#B5562B" }}>Nhóm thua nhiều hơn</span>
        </div>
      </div>

      <ScheduleBoard initialMatches={matches} pairIdToTeamId={pairIdToTeamId} />
    </div>
  );
}
