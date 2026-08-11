import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getTeams } from "@/lib/supabase/tournament";
import { TIER, type TTier } from "@/lib/tournament/data";

const TIER_ORDER: TTier[] = [1, 2, 3, 4];

// Read fresh from Supabase on every request: the roster (đội hình) is edited in the admin during
// setup, so /teams must reflect pair/player changes immediately (mirrors /schedule).
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div className="mx-auto max-w-[1240px] px-5 pt-[34px] pb-[60px]">
      <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[clamp(30px,4.6vw,52px)] font-black tracking-[-.035em]">
        8 cặp đôi
      </h2>
      <p className="mt-2.5 max-w-[560px] text-[15px] leading-[1.6] text-[#3C5A53]">
        16 tay vợt được xếp vào 4 bậc trình. Luật ghép cặp: <strong>Bậc 1 + Bậc 4</strong> và{" "}
        <strong>Bậc 2 + Bậc 3</strong> — để mọi cặp có sức mạnh tương đương nhau.
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {TIER_ORDER.map((n) => (
          <Badge
            key={n}
            variant="outline"
            className="gap-2 rounded-full border-border bg-card py-[7px] pr-3.5 pl-2 text-xs font-semibold text-[#3C5A53]"
          >
            <span
              className="flex size-[22px] items-center justify-center rounded-full font-[family-name:var(--font-jetbrains)] text-[11px] font-bold"
              style={{ background: TIER[n].color, color: TIER[n].fg }}
            >
              {n}
            </span>
            {TIER[n].label}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {teams.map((t, i) => (
          <Reveal key={t.id} delay={Math.min(i * 0.05, 0.3)}>
            <Card className="rounded-[22px] border-border bg-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[.14em] text-text-faint">
                    ĐỘI {t.letter}
                  </div>
                </div>
                <div className="mt-1 text-[22px] font-black tracking-[-.02em]">{t.name}</div>
                <div className="mt-4 flex flex-col gap-4">
                  {t.players.map((p) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <PlayerAvatar player={p} size={64} initials="double" />
                      <div className="min-w-0">
                        <div className="text-base font-bold">{p.name}</div>
                        <div className="mt-0.5 font-[family-name:var(--font-jetbrains)] text-[11px] text-text-faint">
                          {TIER[p.tier].label}
                        </div>
                      </div>
                      <span
                        className="ml-auto flex size-[26px] flex-none items-center justify-center rounded-full font-[family-name:var(--font-jetbrains)] text-xs font-bold"
                        style={{ background: TIER[p.tier].color, color: TIER[p.tier].fg }}
                      >
                        {p.tier}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
