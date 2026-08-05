import { Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { getMatches, getPairIdToTeamId } from "@/lib/supabase/tournament";
import { ScheduleBoard } from "./ScheduleBoard";

// Read fresh from Supabase on every request for a correct first paint — the Swiss board,
// playoffs, and tracking table then hydrate into a client island (ScheduleBoard) that stays live
// via Supabase Realtime, so scores update without a reload after the initial SSR.
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);

  return (
    <div className="mx-auto max-w-[1240px] px-5 pt-[34px] pb-[60px]">
      <Reveal>
        <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[clamp(30px,4.6vw,52px)] font-black tracking-[-.035em]">
          Lịch &amp; bảng đấu
        </h2>
        <p className="mt-2.5 max-w-[640px] text-[15px] leading-[1.6] text-[#3C5A53]">
          Thể thức <strong>Swiss-system</strong> theo chuẩn esport, mỗi trận <strong>Bo1</strong> (1 ván tới 21). Sau
          mỗi vòng, các đội cùng thành tích được ghép với nhau. Thắng đủ <strong>3 trận</strong> → vào playoffs. Thua
          đủ <strong>3 trận</strong> → dừng bước. Tối đa 5 vòng, 2 sân chạy song song.
        </p>

        <div className="mt-[18px] flex flex-wrap gap-2.5">
          <Badge
            variant="outline"
            className="gap-2 rounded-full border-[#A8D3BB] bg-[#EEF7F1] px-3.5 py-[7px] text-xs font-bold text-[#1F7A45]"
          >
            <span className="size-[9px] rounded-full bg-[#1F7A45]" />
            Nhóm thắng nhiều hơn
          </Badge>
          <Badge
            variant="outline"
            className="gap-2 rounded-full border-[#EBD7A4] bg-[#FFF9EC] px-3.5 py-[7px] text-xs font-bold text-[#A3790A]"
          >
            <span className="size-[9px] rounded-full bg-[#A3790A]" />
            Nhóm cân bằng
          </Badge>
          <Badge
            variant="outline"
            className="gap-2 rounded-full border-[#E6C0A4] bg-[#FBEFE7] px-3.5 py-[7px] text-xs font-bold text-[#B5562B]"
          >
            <span className="size-[9px] rounded-full bg-[#B5562B]" />
            Nhóm thua nhiều hơn
          </Badge>
        </div>
      </Reveal>

      <ScheduleBoard initialMatches={matches} pairIdToTeamId={pairIdToTeamId} />
    </div>
  );
}
