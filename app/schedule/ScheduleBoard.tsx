"use client";

import { Check, Trophy, X } from "lucide-react";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLiveMatches } from "@/lib/supabase/useLiveMatches";
import { getTeam } from "@/lib/tournament/data";
import type { IMatch } from "@/lib/tournament/data";
import {
  buildTeamRecords,
  computeEliminated,
  computeQualified,
  computeSemis,
  computeSwissColumns,
  computeTrackRows,
  type ISwissMatchDisplay,
  type ITeamChip,
} from "@/lib/tournament/standings";

function TeamAvatars({ teamId, size = 20 }: { teamId: number; size?: number }) {
  const team = getTeam(teamId);
  return (
    <div className="flex flex-none gap-0.5">
      {team.players.map((p) => (
        <PlayerAvatar key={p.name} player={p} size={size} />
      ))}
    </div>
  );
}

function SwissMatchCard({ m }: { m: ISwissMatchDisplay }) {
  return (
    <Card className="gap-0 overflow-hidden rounded-[9px] border-[rgba(10,31,26,.12)] bg-white py-0">
      <div className="flex items-center gap-1.5 bg-[rgba(10,31,26,.035)] px-2 py-[5px]">
        <span className="font-[family-name:var(--font-jetbrains)] text-[8.5px] text-[#8AA39C]">{m.meta}</span>
        <span
          className="ml-auto font-[family-name:var(--font-jetbrains)] text-[8.5px] tracking-[.06em]"
          style={{ color: m.stateColor }}
        >
          {m.state}
        </span>
      </div>
      <div className="flex items-center gap-[7px] px-2 py-1.5" style={{ background: m.aBg }}>
        <TeamAvatars teamId={m.aTeamId} />
        <span className="min-w-0 flex-1 text-[11.5px]" style={{ fontWeight: Number(m.aWeight), color: m.aFg }}>
          {m.aName}
        </span>
        <span
          className="font-[family-name:var(--font-jetbrains)] text-[11.5px] font-bold"
          style={{ color: m.aFg }}
        >
          {m.sa}
        </span>
      </div>
      <div
        className="flex items-center gap-[7px] border-t border-[rgba(10,31,26,.07)] px-2 py-1.5"
        style={{ background: m.bBg }}
      >
        <TeamAvatars teamId={m.bTeamId} />
        <span className="min-w-0 flex-1 text-[11.5px]" style={{ fontWeight: Number(m.bWeight), color: m.bFg }}>
          {m.bName}
        </span>
        <span
          className="font-[family-name:var(--font-jetbrains)] text-[11.5px] font-bold"
          style={{ color: m.bFg }}
        >
          {m.sb}
        </span>
      </div>
    </Card>
  );
}

function ChipRow({ chip }: { chip: ITeamChip }) {
  return (
    <div
      data-slot="badge"
      data-variant="outline"
      className="inline-flex w-full shrink-0 items-center justify-start gap-[7px] overflow-hidden rounded-[9px] border border-dashed border-[rgba(10,31,26,.2)] bg-white/75 px-2 py-1.5 text-xs font-medium whitespace-nowrap text-foreground"
    >
      <TeamAvatars teamId={chip.teamId} />
      <span className="min-w-0 flex-1 text-[11.5px] font-bold text-[#0A1F1A]">{chip.name}</span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[#8AA39C]">{chip.rec}</span>
    </div>
  );
}

function QualifiedChip({ chip }: { chip: ITeamChip }) {
  return (
    <div
      data-slot="badge"
      data-variant="default"
      className="inline-flex w-full shrink-0 items-center justify-start gap-[7px] overflow-hidden rounded-lg border border-transparent bg-primary px-2 py-1.5 text-xs font-medium whitespace-nowrap text-primary-foreground"
    >
      <Check className="size-3.5 flex-none" />
      <TeamAvatars teamId={chip.teamId} />
      <span className="min-w-0 flex-1 text-[11.5px] font-bold">{chip.name}</span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-primary-foreground/70">{chip.rec}</span>
    </div>
  );
}

function EliminatedChip({ chip }: { chip: ITeamChip }) {
  return (
    <div
      data-slot="badge"
      data-variant="default"
      className="inline-flex w-full shrink-0 items-center justify-start gap-[7px] overflow-hidden rounded-lg border border-transparent bg-muted px-2 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground line-through"
    >
      <X className="size-3.5 flex-none" />
      <div className="opacity-70">
        <TeamAvatars teamId={chip.teamId} />
      </div>
      <span className="min-w-0 flex-1 text-[11.5px] font-bold">{chip.name}</span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[10px]">{chip.rec}</span>
    </div>
  );
}

interface IScheduleBoardProps {
  initialMatches: IMatch[];
  pairIdToTeamId: Record<string, number>;
}

/**
 * Client island for everything on /schedule that is derived from match results: the Board 1 Swiss
 * columns, the qualified/eliminated lists, the Board 2 semis, and the per-round tracking table.
 * Seeded from the server component's fetch via props (correct SSR/first paint), then kept live by
 * `useLiveMatches` (Supabase Realtime on `matches`) — every derived view is recomputed from the
 * pure `lib/tournament/standings.ts` functions on each change, so this stays a straight port with
 * no duplicated Swiss logic. The page header/intro/legend above stay server-rendered in
 * app/schedule/page.tsx since they never change during the event.
 */
export function ScheduleBoard({ initialMatches, pairIdToTeamId }: IScheduleBoardProps) {
  const [matches] = useLiveMatches(initialMatches, pairIdToTeamId);
  const records = buildTeamRecords(matches);
  const swissCols = computeSwissColumns(matches, records);
  const qualified = computeQualified(records);
  const eliminated = computeEliminated(records);
  const semis = computeSemis(qualified);
  const trackRows = computeTrackRows(records);

  return (
    <>
      {/* Board 1 · Swiss stage */}
      <div className="mt-5 rounded-[22px] border border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-5">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <div className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#5B7A72]">
            BOARD 1 · SWISS STAGE
          </div>
          <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[#B4BEBA]">
            CUỘN NGANG ĐỂ XEM CÁC VÒNG SAU →
          </div>
        </div>
        <div className="overflow-x-auto pb-1.5">
          <div className="grid min-w-[1160px] grid-cols-[repeat(6,minmax(184px,1fr))] items-start gap-3">
            {swissCols.map((col) => (
              <div key={col.round}>
                <div className="rounded-[9px] bg-[#0B5D4E] p-2 text-center text-xs font-extrabold text-[#FFFDF7]">
                  {col.title}
                </div>
                <div
                  className="mt-1.5 mb-2.5 text-center font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[.1em]"
                  style={{ color: col.statusColor }}
                >
                  {col.status}
                </div>
                <div className="flex flex-col gap-2.5">
                  {col.groups.map((g) => (
                    <div
                      key={g.label}
                      className="rounded-xl p-2.5"
                      style={{ background: g.bg, border: `1.5px solid ${g.border}` }}
                    >
                      <div className="text-[11px] font-extrabold tracking-[.04em]" style={{ color: g.fg }}>
                        {g.label}
                      </div>
                      <div className="mt-[3px] text-[9.5px] text-[#8AA39C]">{g.sub}</div>
                      <div className="mt-[9px] flex flex-col gap-[7px]">
                        {g.matches.map((m) => (
                          <SwissMatchCard key={m.code} m={m} />
                        ))}
                        {g.chips.map((c) => (
                          <ChipRow key={c.teamId} chip={c} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <div className="flex items-center justify-center gap-1.5 rounded-[9px] bg-[#0A1F1A] p-2 text-center text-xs font-extrabold text-[#FFFDF7]">
                <Trophy className="size-3.5" />
                Kết quả Swiss
              </div>
              <div className="my-1.5 mt-1.5 mb-2.5 text-center font-[family-name:var(--font-jetbrains)] text-[9px] text-[#8AA39C]">
                4 VÀO · 4 RA
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="rounded-xl border-[1.5px] border-[#9CCFB0] bg-[#E9F8EE] p-2.5">
                  <div className="text-[11px] font-extrabold tracking-[.04em] text-[#1A6B3A]">QUALIFIED · 3 THẮNG</div>
                  <div className="mt-[3px] text-[9.5px] text-[#8AA39C]">Vào Board 2 — playoffs</div>
                  <div className="mt-[9px] flex flex-col gap-1.5">
                    {qualified.map((c) => (
                      <QualifiedChip key={c.teamId} chip={c} />
                    ))}
                  </div>
                  {qualified.length === 0 && (
                    <div className="mt-[9px] text-[11px] text-[#8AA39C] italic">Chưa có đội nào đủ 3 thắng</div>
                  )}
                </div>
                <div className="rounded-xl border-[1.5px] border-[#DCDCD4] bg-[#F3F3F0] p-2.5">
                  <div className="text-[11px] font-extrabold tracking-[.04em] text-[#7A8A85]">ELIMINATED · 3 THUA</div>
                  <div className="mt-[9px] flex flex-col gap-1.5">
                    {eliminated.map((c) => (
                      <EliminatedChip key={c.teamId} chip={c} />
                    ))}
                  </div>
                  {eliminated.length === 0 && (
                    <div className="mt-[9px] text-[11px] text-[#B4BEBA] italic">Chưa có đội nào bị loại</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Board 2 · Playoffs */}
      <div className="mt-[34px] overflow-x-auto rounded-[22px] bg-[#0B5D4E] p-[clamp(22px,3vw,34px)]">
        <div className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#8FBCB0]">
          BOARD 2 · PLAYOFFS (4 ĐỘI QUALIFIED)
        </div>
        <div className="mt-[18px] grid min-w-[660px] grid-cols-[1fr_30px_1fr] items-stretch">
          <div className="flex flex-col justify-center gap-[22px]">
            {semis.map((m) => (
              <Card
                key={m.code}
                className="gap-0 overflow-hidden rounded-xl border-white/[.18] bg-white/[.08] py-0"
              >
                <div className="bg-black/[.18] px-3 py-[7px] font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.1em] text-[#8FBCB0]">
                  {m.code}
                </div>
                <div className="px-3 py-2.5 text-sm font-bold text-[#FFFDF7]">{m.aName}</div>
                <div className="border-t border-white/[.14] px-3 py-2.5 text-sm font-bold text-[#FFFDF7]">
                  {m.bName}
                </div>
              </Card>
            ))}
          </div>
          <div className="my-[62px] rounded-[0_10px_10px_0] border-2 border-l-0 border-white/[.28]" />
          <div className="flex flex-col justify-center gap-3.5 pl-4">
            <Card className="gap-0 rounded-xl border-transparent bg-secondary p-4 text-secondary-foreground">
              <div className="font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.14em]">
                CHUNG KẾT · SÂN 1
              </div>
              <div className="mt-2.5 text-base font-extrabold">Thắng Bán kết 1</div>
              <div className="mt-[7px] text-base font-extrabold">Thắng Bán kết 2</div>
            </Card>
            <Card className="gap-0 rounded-xl border-white/[.18] bg-white/[.08] p-4 text-[#DCEDE7]">
              <div className="font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.14em] text-[#8FBCB0]">
                TRANH HẠNG 3 · SÂN 2
              </div>
              <div className="mt-2.5 text-base font-extrabold">Thua Bán kết 1</div>
              <div className="mt-[7px] text-base font-extrabold">Thua Bán kết 2</div>
            </Card>
          </div>
        </div>
      </div>

      {/* Tracking table */}
      <div className="mt-4 overflow-x-auto rounded-[22px] border border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-[22px]">
        <div className="mb-3.5 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#5B7A72]">
          BẢNG THEO DÕI THEO VÒNG
        </div>
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="border-[rgba(10,31,26,.12)] hover:bg-transparent">
              <TableHead className="h-auto px-0 pb-[9px] font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.08em] text-[#8AA39C]">
                ĐỘI
              </TableHead>
              {["R1", "R2", "R3", "R4", "R5", "T", "B"].map((h) => (
                <TableHead
                  key={h}
                  className="h-auto px-0 pb-[9px] text-center font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.08em] text-[#8AA39C]"
                >
                  {h}
                </TableHead>
              ))}
              <TableHead className="h-auto px-0 pb-[9px] text-center font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.08em] text-[#8AA39C]">
                TRẠNG THÁI
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trackRows.map((r) => (
              <TableRow key={r.teamId} className="border-[rgba(10,31,26,.07)] hover:bg-transparent">
                <TableCell className="px-0 py-[9px]">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamAvatars teamId={r.teamId} size={22} />
                    <span className="text-[13.5px] font-bold">{r.name}</span>
                  </div>
                </TableCell>
                {r.cells.map((c, i) => (
                  <TableCell
                    key={i}
                    className="px-0 py-[9px] text-center font-[family-name:var(--font-jetbrains)] text-xs"
                    style={{ fontWeight: Number(c.weight), color: c.color }}
                  >
                    {c.v}
                  </TableCell>
                ))}
                <TableCell className="px-0 py-[9px] text-center font-[family-name:var(--font-jetbrains)] text-[13px] font-bold text-[#1F7A45]">
                  {r.w}
                </TableCell>
                <TableCell className="px-0 py-[9px] text-center font-[family-name:var(--font-jetbrains)] text-[13px] font-bold text-[#B5562B]">
                  {r.l}
                </TableCell>
                <TableCell className="px-0 py-[9px] text-center">
                  <Badge
                    className="rounded-md px-2.5 py-[3px] text-[10.5px] font-bold"
                    style={{ background: r.statusBg, color: r.statusFg }}
                  >
                    {r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
