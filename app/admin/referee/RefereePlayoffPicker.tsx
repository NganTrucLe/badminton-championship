"use client";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { IMatch } from "@/lib/tournament/data";
import { useTeamLookup } from "@/lib/tournament/teamLookup";
import { isSelectable } from "./refereeControls";

function labelFor(m: IMatch): string {
  if (m.round === 6) return m.court === 1 ? "Bán kết 1" : "Bán kết 2";
  return m.court === 1 ? "Chung kết" : "Tranh hạng 3";
}

interface IRefereePlayoffPickerProps {
  matches: IMatch[];
  activeId: string;
  liveMatchId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Referee-screen picker for Board 2 playoff matches (round 6 semis, round 7 final/3rd) —
 * rendered alongside RefereeSwissPicker, driven by the same `matches`/`activeId`/`liveMatchId`
 * state so there is a single source of truth for which match the scoreboard shows. `matches` is
 * pre-filtered by the caller to round 6/7 rows only.
 */
export function RefereePlayoffPicker({ matches, activeId, liveMatchId, onSelect }: IRefereePlayoffPickerProps) {
  const getTeam = useTeamLookup();
  const liveMatch = liveMatchId ? { id: liveMatchId } : undefined;
  if (matches.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="mb-2 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#5B7A72]">
        BOARD 2 · PLAYOFFS
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((m) => {
          const selectable = isSelectable(m, liveMatch);
          const a = getTeam(m.a);
          const b = getTeam(m.b);
          return (
            <button
              key={m.id}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect(m.id)}
              className="block w-full rounded-[9px] border p-2 text-left"
              style={{
                background: activeId === m.id ? "rgba(11,93,78,.08)" : "#fff",
                border: activeId === m.id ? "1.5px solid #0B5D4E" : "1px solid rgba(10,31,26,.12)",
                opacity: selectable ? 1 : 0.5,
                cursor: selectable ? "pointer" : "default",
              }}
            >
              <div className="text-[10px] font-bold text-[#5B7A72]">{labelFor(m)}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] font-bold">
                {a.players.map((p) => (
                  <PlayerAvatar key={p.name} player={p} size={16} />
                ))}
                {a.name} <span className="text-[#B4BEBA]">vs</span> {b.name}
                {b.players.map((p) => (
                  <PlayerAvatar key={p.name} player={p} size={16} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
