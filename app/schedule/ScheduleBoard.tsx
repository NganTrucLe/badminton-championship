"use client";

import { PlayerAvatar } from "@/components/PlayerAvatar";
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
    <div style={{ display: "flex", gap: 2, flex: "none" }}>
      {team.players.map((p) => (
        <PlayerAvatar key={p.name} player={p} size={size} />
      ))}
    </div>
  );
}

function SwissMatchCard({ m }: { m: ISwissMatchDisplay }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(10,31,26,.12)", borderRadius: 9, overflow: "hidden" }}>
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
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700, color: "#0A1F1A" }}>{chip.name}</span>
      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#8AA39C" }}>{chip.rec}</span>
    </div>
  );
}

function QualifiedChip({ chip }: { chip: ITeamChip }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", borderRadius: 8, padding: "6px 8px" }}>
      <TeamAvatars teamId={chip.teamId} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700 }}>{chip.name}</span>
      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#8AA39C" }}>{chip.rec}</span>
    </div>
  );
}

function EliminatedChip({ chip }: { chip: ITeamChip }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", borderRadius: 8, padding: "6px 8px" }}>
      <div style={{ opacity: 0.7 }}>
        <TeamAvatars teamId={chip.teamId} />
      </div>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700, color: "#7A8A85" }}>{chip.name}</span>
      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#B4BEBA" }}>{chip.rec}</span>
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
      <div style={{ marginTop: 20, background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#5B7A72" }}>
            BOARD 1 · SWISS STAGE
          </div>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#B4BEBA" }}>
            CUỘN NGANG ĐỂ XEM CÁC VÒNG SAU →
          </div>
        </div>
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div style={{ minWidth: 1160, display: "grid", gridTemplateColumns: "repeat(6,minmax(184px,1fr))", gap: 12, alignItems: "start" }}>
            {swissCols.map((col) => (
              <div key={col.round}>
                <div style={{ background: "#0B5D4E", color: "#FFFDF7", borderRadius: 9, padding: 8, textAlign: "center", fontSize: 12, fontWeight: 800 }}>
                  {col.title}
                </div>
                <div style={{ textAlign: "center", fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#8AA39C", margin: "6px 0 2px" }}>
                  {col.time}
                </div>
                <div style={{ textAlign: "center", fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, letterSpacing: ".1em", color: col.statusColor, marginBottom: 10 }}>
                  {col.status}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.groups.map((g) => (
                    <div key={g.label} style={{ background: g.bg, border: `1.5px solid ${g.border}`, borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: g.fg }}>{g.label}</div>
                      <div style={{ fontSize: 9.5, color: "#8AA39C", marginTop: 3 }}>{g.sub}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 9 }}>
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
              <div style={{ background: "#0A1F1A", color: "#FFFDF7", borderRadius: 9, padding: 8, textAlign: "center", fontSize: 12, fontWeight: 800 }}>
                Kết quả Swiss
              </div>
              <div style={{ textAlign: "center", fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#8AA39C", margin: "6px 0 10px" }}>
                4 VÀO · 4 RA
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "#E9F8EE", border: "1.5px solid #9CCFB0", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: "#1A6B3A" }}>
                    QUALIFIED · 3 THẮNG
                  </div>
                  <div style={{ fontSize: 9.5, color: "#8AA39C", marginTop: 3 }}>Vào Board 2 — playoffs</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>
                    {qualified.map((c) => (
                      <QualifiedChip key={c.teamId} chip={c} />
                    ))}
                  </div>
                  {qualified.length === 0 && (
                    <div style={{ marginTop: 9, fontSize: 11, color: "#8AA39C", fontStyle: "italic" }}>
                      Chưa có đội nào đủ 3 thắng
                    </div>
                  )}
                </div>
                <div style={{ background: "#F3F3F0", border: "1.5px solid #DCDCD4", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: "#7A8A85" }}>
                    ELIMINATED · 3 THUA
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>
                    {eliminated.map((c) => (
                      <EliminatedChip key={c.teamId} chip={c} />
                    ))}
                  </div>
                  {eliminated.length === 0 && (
                    <div style={{ marginTop: 9, fontSize: 11, color: "#B4BEBA", fontStyle: "italic" }}>
                      Chưa có đội nào bị loại
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Board 2 · Playoffs */}
      <div style={{ marginTop: 34, background: "#0B5D4E", borderRadius: 22, padding: "clamp(22px,3vw,34px)", overflowX: "auto" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#8FBCB0" }}>
          BOARD 2 · PLAYOFFS (4 ĐỘI QUALIFIED)
        </div>
        <div style={{ marginTop: 18, minWidth: 660, display: "grid", gridTemplateColumns: "1fr 30px 1fr", alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, justifyContent: "center" }}>
            {semis.map((m) => (
              <div key={m.code} style={{ background: "rgba(255,253,247,.08)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9.5, letterSpacing: ".1em", color: "#8FBCB0", padding: "7px 12px", background: "rgba(0,0,0,.18)" }}>
                  {m.code} · {m.time}
                </div>
                <div style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "#FFFDF7" }}>{m.aName}</div>
                <div style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "#FFFDF7", borderTop: "1px solid rgba(255,255,255,.14)" }}>
                  {m.bName}
                </div>
              </div>
            ))}
          </div>
          <div style={{ margin: "62px 0", border: "2px solid rgba(255,255,255,.28)", borderLeft: "none", borderRadius: "0 10px 10px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", paddingLeft: 16 }}>
            <div style={{ background: "#F2B544", borderRadius: 12, padding: 16, color: "#08241E" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9.5, letterSpacing: ".14em" }}>
                CHUNG KẾT · 12:00 · SÂN 1
              </div>
              <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800 }}>Thắng Bán kết 1</div>
              <div style={{ marginTop: 7, fontSize: 16, fontWeight: 800 }}>Thắng Bán kết 2</div>
            </div>
            <div style={{ background: "rgba(255,253,247,.08)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 16, color: "#DCEDE7" }}>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9.5, letterSpacing: ".14em", color: "#8FBCB0" }}>
                TRANH HẠNG 3 · 12:00 · SÂN 2
              </div>
              <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800 }}>Thua Bán kết 1</div>
              <div style={{ marginTop: 7, fontSize: 16, fontWeight: 800 }}>Thua Bán kết 2</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking table */}
      <div style={{ marginTop: 16, background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 22, overflowX: "auto" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#5B7A72", marginBottom: 14 }}>
          BẢNG THEO DÕI THEO VÒNG
        </div>
        <div style={{ minWidth: 640 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr repeat(5,44px) 46px 46px 96px",
              gap: 8,
              paddingBottom: 9,
              borderBottom: "1px solid rgba(10,31,26,.12)",
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 9.5,
              letterSpacing: ".08em",
              color: "#8AA39C",
            }}
          >
            <div>ĐỘI</div>
            <div style={{ textAlign: "center" }}>R1</div>
            <div style={{ textAlign: "center" }}>R2</div>
            <div style={{ textAlign: "center" }}>R3</div>
            <div style={{ textAlign: "center" }}>R4</div>
            <div style={{ textAlign: "center" }}>R5</div>
            <div style={{ textAlign: "center" }}>T</div>
            <div style={{ textAlign: "center" }}>B</div>
            <div style={{ textAlign: "center" }}>TRẠNG THÁI</div>
          </div>
          {trackRows.map((r) => (
            <div
              key={r.teamId}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr repeat(5,44px) 46px 46px 96px",
                gap: 8,
                alignItems: "center",
                padding: "9px 0",
                borderBottom: "1px solid rgba(10,31,26,.07)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <TeamAvatars teamId={r.teamId} size={22} />
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</span>
              </div>
              {r.cells.map((c, i) => (
                <div key={i} style={{ textAlign: "center", fontFamily: "var(--font-jetbrains), monospace", fontSize: 12, fontWeight: Number(c.weight), color: c.color }}>
                  {c.v}
                </div>
              ))}
              <div style={{ textAlign: "center", fontFamily: "var(--font-jetbrains), monospace", fontSize: 13, fontWeight: 700, color: "#1F7A45" }}>
                {r.w}
              </div>
              <div style={{ textAlign: "center", fontFamily: "var(--font-jetbrains), monospace", fontSize: 13, fontWeight: 700, color: "#B5562B" }}>
                {r.l}
              </div>
              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    background: r.statusBg,
                    color: r.statusFg,
                    borderRadius: 6,
                    padding: "3px 9px",
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
