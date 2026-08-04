export function RefereeNotLivePanel({ status }: { status: "setup" | "live" | "done" }) {
  const msg =
    status === "done"
      ? "Giải đã kết thúc — không thể cập nhật tỉ số."
      : "Giải chưa bắt đầu. Vào Tổng quan và bấm “Gửi đội hình & bắt đầu giải” để mở phần chấm điểm.";
  return (
    <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 20, padding: 28 }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 26, fontWeight: 900 }}>
        Cập nhật tỉ số
      </h2>
      <p style={{ marginTop: 12, color: "#5B7A72", fontSize: 15 }}>{msg}</p>
    </div>
  );
}
