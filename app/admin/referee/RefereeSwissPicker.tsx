"use client";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Badge } from "@/components/ui/badge";
import type { IMatch, ITeam } from "@/lib/tournament/data";
import { buildTeamRecords, computeSwissColumns, type ISwissMatchDisplay, type ITeamChip } from "@/lib/tournament/standings";
import { useTeamLookup } from "@/lib/tournament/teamLookup";
import { isSelectable } from "./refereeControls";

function TeamAvatars({ teamId, size = 18 }: { teamId: number; size?: number }) {
  const getTeam = useTeamLookup();
  const team = getTeam(teamId);
  return (
    <div className="flex flex-none gap-[2px]">
      {team.players.map((p) => (
        <PlayerAvatar key={p.name} player={p} size={size} />
      ))}
    </div>
  );
}

function ChipRow({ chip }: { chip: ITeamChip }) {
  return (
    <div className="flex items-center gap-[7px] rounded-[9px] border border-dashed border-[rgba(10,31,26,.2)] bg-white/75 px-2 py-[6px]">
      <TeamAvatars teamId={chip.teamId} />
      <span className="min-w-0 flex-1 text-[11px] font-bold text-[#0A1F1A]">{chip.name}</span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[9.5px] text-[#8AA39C]">{chip.rec}</span>
    </div>
  );
}

interface IRefereeSwissMatchCardProps {
  m: ISwissMatchDisplay;
  active: boolean;
  selectable: boolean;
  onSelect: (id: string) => void;
}

function RefereeSwissMatchCard({ m, active, selectable, onSelect }: IRefereeSwissMatchCardProps) {
  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={() => onSelect(m.code)}
      className="block w-full overflow-hidden rounded-[9px] p-0 text-left font-[family-name:var(--font-archivo)] disabled:cursor-default"
      style={{
        background: active ? "rgba(11,93,78,.08)" : "#fff",
        border: active ? "1.5px solid #0B5D4E" : "1px solid rgba(10,31,26,.12)",
        cursor: selectable ? "pointer" : "default",
        opacity: selectable ? 1 : 0.5,
      }}
    >
      <div className="flex items-center gap-[6px] bg-[rgba(10,31,26,.035)] px-2 py-[5px]">
        <Badge
          className="ml-auto rounded-full bg-transparent px-0 font-[family-name:var(--font-jetbrains)] text-[8.5px] tracking-[.06em]"
          style={{ color: m.stateColor }}
        >
          {m.state}
        </Badge>
      </div>
      <div className="flex items-center gap-[7px] px-2 py-[6px]" style={{ background: m.aBg }}>
        <TeamAvatars teamId={m.aTeamId} />
        <span className="min-w-0 flex-1 text-[11.5px]" style={{ fontWeight: Number(m.aWeight), color: m.aFg }}>
          {m.aName}
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-[11.5px] font-bold" style={{ color: m.aFg }}>
          {m.sa}
        </span>
      </div>
      <div
        className="flex items-center gap-[7px] border-t border-[rgba(10,31,26,.07)] px-2 py-[6px]"
        style={{ background: m.bBg }}
      >
        <TeamAvatars teamId={m.bTeamId} />
        <span className="min-w-0 flex-1 text-[11.5px]" style={{ fontWeight: Number(m.bWeight), color: m.bFg }}>
          {m.bName}
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-[11.5px] font-bold" style={{ color: m.bFg }}>
          {m.sb}
        </span>
      </div>
    </button>
  );
}

interface IRefereeSwissPickerProps {
  matches: IMatch[];
  activeId: string;
  liveMatchId: string | null;
  onSelect: (id: string) => void;
  teams: ITeam[];
}

/**
 * Referee-screen picker: a compact, horizontally-scrolling Swiss column tree (one column per
 * round), replacing the flat "CHỌN TRẬN" list. Driven entirely by the same pure Swiss functions
 * ScheduleBoard uses (`buildTeamRecords` + `computeSwissColumns`), so it stays a straight
 * read-model over the live `matches` — no duplicated pairing/standings logic here. Each display
 * match is mapped back to its live `IMatch` by `code` (which is the match `id`) purely to read
 * `state` for the selectability rule from `refereeControls.isSelectable`.
 */
export function RefereeSwissPicker({ matches, activeId, liveMatchId, onSelect, teams }: IRefereeSwissPickerProps) {
  const records = buildTeamRecords(matches, teams);
  const swissCols = computeSwissColumns(matches, records, teams);
  const liveMatch = liveMatchId ? { id: liveMatchId } : undefined;

  return (
    <div className="overflow-x-auto pb-[6px]">
      <div className="flex items-start gap-3" style={{ minWidth: swissCols.length * 196 }}>
        {swissCols.map((col) => (
          <div key={col.round} className="w-[184px] flex-none">
            <div className="rounded-[9px] bg-[#0B5D4E] p-2 text-center text-[12px] font-extrabold text-[#FFFDF7]">
              {col.title}
            </div>
            <div
              className="mt-[6px] mb-[10px] text-center font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[.1em]"
              style={{ color: col.statusColor }}
            >
              {col.status}
            </div>
            <div className="flex flex-col gap-[10px]">
              {col.groups.map((g) => (
                <div key={g.label} className="rounded-xl p-[10px]" style={{ background: g.bg, border: `1.5px solid ${g.border}` }}>
                  <div className="text-[11px] font-extrabold tracking-[.04em]" style={{ color: g.fg }}>
                    {g.label}
                  </div>
                  <div className="mt-[3px] text-[9.5px] text-[#8AA39C]">{g.sub}</div>
                  <div className="mt-[9px] flex flex-col gap-[7px]">
                    {g.matches.map((m) => {
                      const match = matches.find((x) => x.id === m.code);
                      const selectable = match ? isSelectable(match, liveMatch) : false;
                      return (
                        <RefereeSwissMatchCard
                          key={m.code}
                          m={m}
                          active={m.code === activeId}
                          selectable={selectable}
                          onSelect={onSelect}
                        />
                      );
                    })}
                    {g.chips.map((c) => (
                      <ChipRow key={c.teamId} chip={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
