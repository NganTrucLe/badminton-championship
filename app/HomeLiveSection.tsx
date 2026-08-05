"use client";

import { useLiveMatches } from "@/lib/supabase/useLiveMatches";
import { computeLiveMatch, computeRecentResults } from "@/lib/tournament/standings";
import type { IMatch } from "@/lib/tournament/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LivePulse } from "@/components/brand/LivePulse";

interface IHomeLiveSectionProps {
  initialMatches: IMatch[];
  pairIdToTeamId: Record<string, number>;
}

/**
 * Client island for the home page's two live-changing blocks (live match card + recent results).
 * Seeded from the server component's fetch via props for correct SSR/first paint, then kept live
 * by `useLiveMatches` (Supabase Realtime on `matches`) so a referee's score update appears here
 * without a reload. The hero, location, and rewards blocks stay server-rendered in app/page.tsx —
 * they never change during the event, so there's no reason to ship them as client JS.
 */
export function HomeLiveSection({ initialMatches, pairIdToTeamId }: IHomeLiveSectionProps) {
  const [matches] = useLiveMatches(initialMatches, pairIdToTeamId);
  const live = computeLiveMatch(matches);
  const recent = computeRecentResults(matches);

  return (
    <>
      {live && (
        <Card className="col-span-1 gap-0 overflow-hidden rounded-[22px] border-none bg-[var(--color-dark)] p-[26px] text-cream">
          <div className="flex items-center gap-[9px]">
            <LivePulse />
            <Badge
              variant="outline"
              className="rounded-none border-none bg-transparent p-0 font-mono text-[11px] tracking-[.18em] text-[#FF8C7D]"
            >
              ĐANG THI ĐẤU
            </Badge>
            <span className="ml-auto font-mono text-[11px] text-[#6E8A83]">
              {live.round} · SÂN {live.court}
            </span>
          </div>
          <div className="mt-[22px] grid grid-cols-[1fr_auto_1fr] items-center gap-[14px]">
            <div>
              <div className="text-[13px] font-extrabold tracking-[.04em] text-[#8FBCB0]">{live.aName}</div>
              <div className="mt-[5px] text-[17px] font-bold leading-[1.3]">{live.aPlayers}</div>
            </div>
            <div className="whitespace-nowrap font-mono text-[clamp(38px,6vw,54px)] font-bold tracking-[-.03em]">
              {live.aScore}
              <span className="mx-[6px] text-[#496660]">:</span>
              {live.bScore}
            </div>
            <div className="text-right">
              <div className="text-[13px] font-extrabold tracking-[.04em] text-[#8FBCB0]">{live.bName}</div>
              <div className="mt-[5px] text-[17px] font-bold leading-[1.3]">{live.bPlayers}</div>
            </div>
          </div>
          <div className="mt-[22px] h-[5px] overflow-hidden rounded-full bg-white/12">
            {/* live.pct is a runtime percentage string ("81%") — kept as an inline dynamic width
                rather than forced through shadcn Progress (which expects a numeric 0-100 value
                and would need re-parsing the same string right back out). */}
            <div className="h-full rounded-full bg-secondary" style={{ width: live.pct }} />
          </div>
          <div className="mt-[10px] font-mono text-[10px] text-[#6E8A83]">CHẠM 21 · CÁCH BIỆT 2 ĐIỂM</div>
        </Card>
      )}

      <Card className="gap-0 rounded-[22px] border-[rgba(10,31,26,.12)] bg-cream p-[26px]">
        <div className="font-mono text-[10px] tracking-[.16em] text-[#5B7A72]">KẾT QUẢ GẦN NHẤT</div>
        <div className="mt-4 flex flex-col gap-0.5">
          {recent.map((m) => (
            <div
              key={m.code}
              className="flex items-center gap-3 border-b border-[rgba(10,31,26,.08)] py-[11px]"
            >
              <span className="min-w-0 flex-1 text-sm font-bold">{m.aName}</span>
              <span className="flex-none font-mono text-[15px] font-bold">{m.score}</span>
              <span className="min-w-0 flex-1 text-right text-sm font-bold text-[#5B7A72]">{m.bName}</span>
            </div>
          ))}
          {recent.length === 0 && (
            <div className="py-[11px] text-[13px] italic text-[#8AA39C]">Chưa có kết quả nào.</div>
          )}
        </div>
        <a href="/schedule" className="mt-4 inline-block font-sans text-[13px] font-bold text-[#0B5D4E]">
          Xem toàn bộ lịch đấu →
        </a>
      </Card>
    </>
  );
}
