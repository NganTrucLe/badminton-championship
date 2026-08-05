import { Card } from "@/components/ui/card";

export function RefereeNotLivePanel({ status }: { status: "setup" | "live" | "done" }) {
  const msg =
    status === "done"
      ? "Giải đã kết thúc — không thể cập nhật tỉ số."
      : "Giải chưa bắt đầu. Vào Tổng quan và bấm “Gửi đội hình & bắt đầu giải” để mở phần chấm điểm.";
  return (
    <Card className="gap-0 rounded-[20px] border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-7">
      <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[26px] font-black">
        Cập nhật tỉ số
      </h2>
      <p className="mt-3 text-[15px] text-[#5B7A72]">{msg}</p>
    </Card>
  );
}
