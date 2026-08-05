import { getTournament } from "@/lib/supabase/tournament";
import type { IReward } from "@/lib/tournament/reward";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion";

// Reads the podium copy (title/detail per place) from the tournament config in Supabase so
// organizers can update reward text without a code change. Styling/markup is unchanged from the
// previous hardcoded block — only the text now comes from `rewards`.
export async function RewardsPodium() {
  const { rewards } = await getTournament();
  const byPlace = (n: number): IReward => rewards.find((r) => r.place === n) ?? rewards[0];
  const first = byPlace(1);
  const second = byPlace(2);
  const third = byPlace(3);

  return (
    <div className="flex items-end justify-center gap-4 flex-wrap py-5 pb-2">
      <Reveal delay={0}>
        <div className="flex flex-col items-center gap-3 w-[220px]">
          <div className="size-[76px] rounded-full bg-[#C9D6D2] flex items-center justify-center text-[30px] font-black text-[#08241E] shadow-[0_6px_0_rgba(10,31,26,.18)]">
            🥈
          </div>
          <div className="text-[19px] font-extrabold leading-[1.3] text-center">{second.title}</div>
          <Card className="bg-card border border-border h-[150px] rounded-t-[20px] rounded-b-[10px] w-full flex flex-col items-center justify-center gap-1.5 p-0">
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[.18em] text-[#5B7A72]">HẠNG NHÌ</div>
            <div className="text-[44px] font-black tracking-[-.05em] text-[#0B5D4E]">02</div>
            <div className="text-[13px] text-[#8AA39C]">{second.detail}</div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="flex flex-col items-center gap-3 w-[240px]">
          <div className="size-24 rounded-full bg-[#F2B544] flex items-center justify-center text-[40px] font-black text-[#08241E] shadow-[0_8px_0_rgba(10,31,26,.2)]">
            🏆
          </div>
          <div className="text-[21px] font-black leading-[1.3] text-center">{first.title}</div>
          <Card className="bg-[#F2B544] h-[200px] rounded-t-[24px] rounded-b-[10px] w-full flex flex-col items-center justify-center gap-2 p-0 text-[#08241E]">
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[.18em]">HẠNG NHẤT</div>
            <div className="text-[56px] font-black tracking-[-.05em]">01</div>
            <div className="text-[14px] opacity-75">{first.detail}</div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="flex flex-col items-center gap-3 w-[220px]">
          <div className="size-[76px] rounded-full bg-[#E0A672] flex items-center justify-center text-[30px] font-black text-[#08241E] shadow-[0_6px_0_rgba(10,31,26,.18)]">
            🥉
          </div>
          <div className="text-[19px] font-extrabold leading-[1.3] text-center">{third.title}</div>
          <Card className="bg-card border border-border h-[130px] rounded-t-[20px] rounded-b-[10px] w-full flex flex-col items-center justify-center gap-1.5 p-0">
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[.18em] text-[#5B7A72]">HẠNG BA</div>
            <div className="text-[40px] font-black tracking-[-.05em] text-[#0B5D4E]">03</div>
            <div className="text-[13px] text-[#8AA39C]">{third.detail}</div>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
