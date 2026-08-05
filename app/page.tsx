import { Suspense } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";

import { Countdown } from "@/components/Countdown";
import { LivePulse } from "@/components/brand/LivePulse";
import { Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HomeLiveSection } from "@/app/HomeLiveSection";
import { HomeLiveSkeleton } from "@/app/HomeLiveSkeleton";
import { RewardsPodium } from "@/app/RewardsPodium";
import { getMatches, getPairIdToTeamId } from "@/lib/supabase/tournament";

const EVENT_START = "2026-08-15T09:00:00+07:00";

// Read fresh from Supabase on every request for a correct first paint — the live match card and
// recent results then hydrate into a client island (HomeLiveSection) that stays live via
// Supabase Realtime, so scores update without a reload after the initial SSR.
export const dynamic = "force-dynamic";

async function HomeLiveData() {
  const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);
  return <HomeLiveSection initialMatches={matches} pairIdToTeamId={pairIdToTeamId} />;
}

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <div className="mx-auto mt-[22px] max-w-[1240px] px-5">
        <Reveal>
          <Card className="relative flex min-h-[clamp(430px,60vw,560px)] flex-col justify-between overflow-hidden rounded-[26px] border-none bg-primary p-[clamp(30px,5vw,64px)] text-cream">
            {/* Decorative badminton-court line art */}
            <div className="pointer-events-none absolute inset-0 opacity-50">
              <div className="absolute inset-x-0 top-[26%] h-0.5 bg-white/50" />
              <div className="absolute inset-x-0 bottom-[14%] h-0.5 bg-white/32" />
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/28" />
              <div className="absolute -left-[14%] -right-[14%] top-[20%] -bottom-[40%] rounded-full border-2 border-white/22" />
            </div>
            <div className="pointer-events-none absolute -top-[70px] -right-[70px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(242,181,68,.5),transparent_62%)]" />

            <div className="relative">
              <Badge
                variant="outline"
                className="gap-[9px] rounded-full border-white/24 bg-white/[.13] px-3.5 py-[7px] font-[family-name:var(--font-jetbrains)] text-[11px] font-normal tracking-[.14em] text-[#DCEDE7]"
              >
                <LivePulse className="bg-gold" />
                MÙA GIẢI 2026 · 8 CẶP ĐÔI
              </Badge>
              <h1 className="mt-5 font-[family-name:var(--font-bricolage)] text-[clamp(36px,7vw,84px)] leading-[0.9] font-black tracking-[-.04em] text-cream">
                GIẢI CẦU
                <br />
                LÔNG CLB
                <span className="text-gold">.</span>
              </h1>
              <p className="mt-5 max-w-[440px] text-[clamp(15px,1.6vw,18px)] leading-[1.55] text-[#B9D6CD]">
                16 tay vợt, 8 đội, một buổi sáng. Thể thức Swiss-system (Bo1): thắng đủ 3 trận vào
                playoffs, thua đủ 3 trận dừng bước. Bạn bè trước, ăn thua sau — nhưng vẫn phải
                thắng.
              </p>
            </div>

            <div className="relative mt-[38px] flex flex-wrap items-end gap-[34px]">
              <div>
                <div className="mb-2.5 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#8FBCB0]">
                  TRẬN ĐẤU SẼ BẮT ĐẦU SAU
                </div>
                <Countdown target={EVENT_START} />
              </div>
              <div className="border-l border-white/20 pl-[26px]">
                <div className="mb-2 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#8FBCB0]">
                  THỜI GIAN
                </div>
                <div className="text-xl font-extrabold text-cream">09:00 – 12:00</div>
                <div className="mt-0.5 text-sm text-[#B9D6CD]">Thứ Bảy, 15 tháng 8</div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="relative flex size-3.5 flex-none items-center justify-center rounded-full border-2 border-gold">
                    <span className="absolute size-1 rounded-full bg-gold" />
                  </span>
                  <span className="text-[13px] font-semibold text-[#DCEDE7]">Sân Gia Tưởng, Tân Bình</span>
                </div>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Live / recent / location cards */}
      <Reveal delay={0.1}>
        <div className="mx-auto mt-4 grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 px-5">
          <Suspense fallback={<HomeLiveSkeleton />}>
            <HomeLiveData />
          </Suspense>

          <Card className="rounded-[22px] border-border bg-cream p-[26px]">
            <div className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-text-muted">
              ĐỊA ĐIỂM
            </div>
            <div className="mt-3.5 text-2xl font-black tracking-[-.02em]">Sân Gia Tưởng</div>
            <div className="mt-2 text-sm leading-[1.55] text-text-soft">
              33 Trần Văn Quang, Q. Tân Bình,
              <br />
              TP. Hồ Chí Minh 70000
            </div>
            <div className="relative mt-4 h-[130px] overflow-hidden rounded-[14px] bg-primary">
              <div className="absolute inset-0 opacity-45">
                <div className="absolute inset-x-[8%] top-[14%] bottom-[14%] border-2 border-white/55" />
                <div className="absolute inset-x-[8%] top-1/2 h-0.5 bg-white/55" />
                <div className="absolute top-[14%] bottom-[14%] left-[30%] w-0.5 bg-white/35" />
                <div className="absolute top-[14%] bottom-[14%] right-[30%] w-0.5 bg-white/35" />
              </div>
              <div className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_0_8px_rgba(242,181,68,.25)]" />
            </div>
            <Button
              asChild
              className="mt-3.5 rounded-full bg-primary px-[18px] py-[11px] text-[13px] font-bold text-cream hover:bg-primary/90"
            >
              <a href="https://maps.app.goo.gl/mM8kAaS4AYuqpPJ28" target="_blank" rel="noopener">
                <MapPin />
                Mở Google Maps
                <ArrowUpRight />
              </a>
            </Button>
          </Card>
        </div>
      </Reveal>

      {/* Rewards podium */}
      <Reveal delay={0.2}>
        <div className="mx-auto mt-4 max-w-[1240px] px-5">
          <div className="mb-3.5 flex flex-wrap items-baseline gap-3.5">
            <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[clamp(26px,3.4vw,38px)] font-black tracking-[-.03em]">
              Phần thưởng
            </h2>
            <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-text-faint">
              TOP 3 · CHI TIẾT SẼ CÔNG BỐ TRƯỚC NGÀY THI ĐẤU
            </span>
          </div>
          <Suspense fallback={<div className="h-[260px]" />}>
            <RewardsPodium />
          </Suspense>
        </div>
      </Reveal>
    </div>
  );
}
