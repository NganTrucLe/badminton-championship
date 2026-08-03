"use client";

import { useLiveMatches } from "@/lib/supabase/useLiveMatches";
import { computeLiveMatch, computeRecentResults } from "@/lib/tournament/standings";
import type { IMatch } from "@/lib/tournament/data";

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
        <div
          style={{
            gridColumn: "span 1",
            background: "#0A1F1A",
            borderRadius: 22,
            padding: 26,
            color: "#FFFDF7",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#FF5A47",
                animation: "livePulse 1.3s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 11,
                letterSpacing: ".18em",
                color: "#FF8C7D",
              }}
            >
              ĐANG THI ĐẤU
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 11,
                color: "#6E8A83",
              }}
            >
              {live.round} · SÂN {live.court}
            </span>
          </div>
          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", color: "#8FBCB0" }}>
                {live.aName}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 5, lineHeight: 1.3 }}>{live.aPlayers}</div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontWeight: 700,
                fontSize: "clamp(38px,6vw,54px)",
                letterSpacing: "-.03em",
                whiteSpace: "nowrap",
              }}
            >
              {live.aScore}
              <span style={{ color: "#496660", margin: "0 6px" }}>:</span>
              {live.bScore}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", color: "#8FBCB0" }}>
                {live.bName}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 5, lineHeight: 1.3 }}>{live.bPlayers}</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 22,
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,.12)",
              overflow: "hidden",
            }}
          >
            <div style={{ height: "100%", background: "#F2B544", borderRadius: 999, width: live.pct }} />
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10,
              color: "#6E8A83",
            }}
          >
            CHẠM 21 · CÁCH BIỆT 2 ĐIỂM
          </div>
        </div>
      )}

      <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 26 }}>
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 10,
            letterSpacing: ".16em",
            color: "#5B7A72",
          }}
        >
          KẾT QUẢ GẦN NHẤT
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
          {recent.map((m) => (
            <div
              key={m.code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid rgba(10,31,26,.08)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 10,
                  color: "#8AA39C",
                  width: 26,
                  flex: "none",
                }}
              >
                {m.code}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0 }}>{m.aName}</span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  flex: "none",
                }}
              >
                {m.score}
              </span>
              <span
                style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0, textAlign: "right", color: "#5B7A72" }}
              >
                {m.bName}
              </span>
            </div>
          ))}
          {recent.length === 0 && (
            <div style={{ fontSize: 13, color: "#8AA39C", fontStyle: "italic", padding: "11px 0" }}>
              Chưa có kết quả nào.
            </div>
          )}
        </div>
        <a
          href="/schedule"
          style={{
            marginTop: 16,
            display: "inline-block",
            fontFamily: "var(--font-archivo), sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: "#0B5D4E",
          }}
        >
          Xem toàn bộ lịch đấu →
        </a>
      </div>
    </>
  );
}
