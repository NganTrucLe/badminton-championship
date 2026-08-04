"use client";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getTeam, type IMatch } from "@/lib/tournament/data";
import { buildTeamRecords, computeSwissColumns, type ISwissMatchDisplay, type ITeamChip } from "@/lib/tournament/standings";
import { isSelectable } from "./refereeControls";

function TeamAvatars({ teamId, size = 18 }: { teamId: number; size?: number }) {
  const team = getTeam(teamId);
  return (
    <div style={{ display: "flex", gap: 2, flex: "none" }}>
      {team.players.map((p) => (
        <PlayerAvatar key={p.name} player={p} size={size} />
      ))}
    </div>
  );
}

function ChipRow({ chip }: { chip: ITeamChip }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: "rgba(255,255,255,.75)",
        border: "1px dashed rgba(10,31,26,.2)",
        borderRadius: 9,
        padding: "6px 8px",
      }}
    >
      <TeamAvatars teamId={chip.teamId} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: "#0A1F1A" }}>{chip.name}</span>
      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9.5, color: "#8AA39C" }}>{chip.rec}</span>
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
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: 0,
        background: active ? "rgba(11,93,78,.08)" : "#fff",
        border: active ? "1.5px solid #0B5D4E" : "1px solid rgba(10,31,26,.12)",
        borderRadius: 9,
        overflow: "hidden",
        cursor: selectable ? "pointer" : "default",
        opacity: selectable ? 1 : 0.5,
        fontFamily: "var(--font-archivo), sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          background: "rgba(10,31,26,.035)",
        }}
      >
        <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8.5, color: "#8AA39C" }}>
          {m.meta}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 8.5,
            letterSpacing: ".06em",
            color: m.stateColor,
          }}
        >
          {m.state}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", background: m.aBg }}>
        <TeamAvatars teamId={m.aTeamId} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: Number(m.aWeight), color: m.aFg }}>
          {m.aName}
        </span>
        <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 11.5, fontWeight: 700, color: m.aFg }}>
          {m.sa}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 8px",
          background: m.bBg,
          borderTop: "1px solid rgba(10,31,26,.07)",
        }}
      >
        <TeamAvatars teamId={m.bTeamId} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: Number(m.bWeight), color: m.bFg }}>
          {m.bName}
        </span>
        <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 11.5, fontWeight: 700, color: m.bFg }}>
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
}

/**
 * Referee-screen picker: a compact, horizontally-scrolling Swiss column tree (one column per
 * round), replacing the flat "CHỌN TRẬN" list. Driven entirely by the same pure Swiss functions
 * ScheduleBoard uses (`buildTeamRecords` + `computeSwissColumns`), so it stays a straight
 * read-model over the live `matches` — no duplicated pairing/standings logic here. Each display
 * match is mapped back to its live `IMatch` by `code` (which is the match `id`) purely to read
 * `state` for the selectability rule from `refereeControls.isSelectable`.
 */
export function RefereeSwissPicker({ matches, activeId, liveMatchId, onSelect }: IRefereeSwissPickerProps) {
  const records = buildTeamRecords(matches);
  const swissCols = computeSwissColumns(matches, records);
  const liveMatch = liveMatchId ? { id: liveMatchId } : undefined;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 6 }}>
      <div style={{ minWidth: swissCols.length * 196, display: "flex", gap: 12, alignItems: "flex-start" }}>
        {swissCols.map((col) => (
          <div key={col.round} style={{ width: 184, flex: "none" }}>
            <div style={{ background: "#0B5D4E", color: "#FFFDF7", borderRadius: 9, padding: 8, textAlign: "center", fontSize: 12, fontWeight: 800 }}>
              {col.title}
            </div>
            <div
              style={{
                textAlign: "center",
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 9,
                letterSpacing: ".1em",
                color: col.statusColor,
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              {col.status}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {col.groups.map((g) => (
                <div key={g.label} style={{ background: g.bg, border: `1.5px solid ${g.border}`, borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: g.fg }}>{g.label}</div>
                  <div style={{ fontSize: 9.5, color: "#8AA39C", marginTop: 3 }}>{g.sub}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 9 }}>
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
