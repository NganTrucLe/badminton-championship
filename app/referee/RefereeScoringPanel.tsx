"use client";

import { useMemo, useState } from "react";
import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useLiveMatches } from "@/lib/supabase/useLiveMatches";
import { teamName, teamPlayersLabel, type IMatch, type TMatchState } from "@/lib/tournament/data";

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  done: { label: "KẾT THÚC", color: "#8AA39C" },
  live: { label: "ĐANG ĐẤU", color: "#FF5A47" },
  next: { label: "SẮP DIỄN RA", color: "#0B5D4E" },
};

function firstDefaultMatchId(matches: { id: string; state: string }[]): string {
  return matches.find((m) => m.state === "live")?.id ?? matches.find((m) => m.state === "next")?.id ?? matches[0]?.id ?? "";
}

interface IRefereeScoringPanelProps {
  initialMatches: IMatch[];
  pairIdToTeamId: Record<string, number>;
}

/**
 * Only ever rendered server-side after `getOrganizerSession()` confirms `isOrganizer === true`
 * (see app/referee/page.tsx) — the actual write-authorization boundary is the DB RLS policy
 * (`organizers can update/insert matches`, gated by `is_organizer()`), not this render check. If a
 * write is somehow attempted by a non-organizer session, Postgres rejects it and `commit()` below
 * surfaces the error instead of silently succeeding.
 *
 * Concurrency (v1, documented per plan): writes are whole-row UPDATEs keyed by match `code`, with
 * no optimistic-concurrency check (no version column, no "claimed by" lock). If two organizers
 * edit the same match around the same time, the later UPDATE simply overwrites the earlier one —
 * last-write-wins on the whole score/state row. A per-match lock/claim is an explicitly deferred
 * follow-up, not this phase.
 */
export function RefereeScoringPanel({ initialMatches, pairIdToTeamId }: IRefereeScoringPanelProps) {
  const { signOut } = useRefereeAuth();
  const [matches, setMatches] = useLiveMatches(initialMatches, pairIdToTeamId);

  const [activeId, setActiveId] = useState<string>(() => firstDefaultMatchId(matches));
  const activeMatch = useMemo(() => matches.find((m) => m.id === activeId) ?? matches[0], [matches, activeId]);
  const [draftA, setDraftA] = useState<number>(() => activeMatch?.sa ?? 0);
  const [draftB, setDraftB] = useState<number>(() => activeMatch?.sb ?? 0);
  const [savedMsg, setSavedMsg] = useState<string>("Mọi thay đổi hiển thị ngay trên trang chủ.");
  const [saving, setSaving] = useState(false);

  function selectMatch(id: string) {
    const m = matches.find((x) => x.id === id);
    if (!m) return;
    setActiveId(id);
    setDraftA(m.sa);
    setDraftB(m.sb);
    setSavedMsg(`Đang chỉnh ${id}.`);
  }

  function bump(side: "a" | "b", delta: number) {
    if (side === "a") setDraftA((v) => Math.max(0, v + delta));
    else setDraftB((v) => Math.max(0, v + delta));
  }

  /**
   * Persists the draft score to `public.matches` via the authenticated browser client — the same
   * client used for the Google sign-in session (`createBrowserSupabaseClient`), so the request
   * carries the organizer's JWT and RLS's `is_organizer()` check passes. Matched by `code` (the
   * human-readable id like "M5") rather than the row's uuid, since that's all the app's `IMatch`
   * shape carries — `code` is unique.
   */
  async function commit(state: TMatchState) {
    if (!activeMatch || saving) return;
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      // `.select()` here is load-bearing, not decorative: RLS's `using()` clause on the update
      // policy silently filters out rows a non-organizer isn't allowed to touch — PostgREST then
      // reports zero rows updated with NO `error`, not a permission-denied. Without `.select()` we
      // can't tell "0 rows matched" from "1 row updated" and would show a false "saved" message.
      const { data, error } = await supabase
        .from("matches")
        .update({ score_a: draftA, score_b: draftB, state })
        .eq("code", activeMatch.id)
        .select();

      if (error) {
        setSavedMsg(`Lỗi khi lưu ${activeMatch.id}: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        setSavedMsg(`Không thể lưu ${activeMatch.id}: tài khoản này không có quyền trọng tài.`);
        return;
      }

      // Optimistic local patch ahead of the realtime echo, so the "CHỌN TRẬN" list and state
      // badge update instantly even if the realtime round-trip lags.
      setMatches((prev) => prev.map((m) => (m.id === activeMatch.id ? { ...m, sa: draftA, sb: draftB, state } : m)));
      setSavedMsg(
        state === "done"
          ? `Đã kết thúc ${activeMatch.id} · ${draftA}–${draftB}`
          : `Đã lưu ${activeMatch.id} lúc ${new Date().toLocaleTimeString("vi-VN")}`,
      );
    } catch (err) {
      setSavedMsg(`Lỗi khi lưu ${activeMatch.id}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!activeMatch) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-bricolage), Archivo, sans-serif",
            fontSize: "clamp(28px,4vw,44px)",
            fontWeight: 900,
            letterSpacing: "-.035em",
          }}
        >
          Cập nhật tỉ số
        </h2>
        <button
          type="button"
          onClick={() => {
            void signOut();
          }}
          style={{
            marginLeft: "auto",
            border: "1px solid rgba(10,31,26,.18)",
            background: "transparent",
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: "var(--font-archivo), sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: "#3C5A53",
          }}
        >
          Đăng xuất
        </button>
      </div>

      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 20, padding: 20 }}>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#5B7A72" }}>
            CHỌN TRẬN
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.map((m) => {
              const selected = m.id === activeId;
              const meta = STATE_LABEL[m.state];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMatch(m.id)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    border: `1px solid ${selected ? "#0B5D4E" : "rgba(10,31,26,.12)"}`,
                    background: selected ? "rgba(11,93,78,.08)" : "transparent",
                    borderRadius: 12,
                    padding: "12px 14px",
                    cursor: "pointer",
                    fontFamily: "var(--font-archivo), sans-serif",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#8AA39C" }}>
                      {m.id} · {m.time}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: 9,
                        letterSpacing: ".1em",
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "#0A1F1A" }}>
                    {teamName(m.a)} vs {teamName(m.b)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ gridColumn: "span 1", background: "#0A1F1A", borderRadius: 20, padding: "clamp(20px,3vw,30px)", color: "#FFFDF7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#8FBCB0" }}>
              {activeMatch.id} · SÂN {activeMatch.court}
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".12em", color: "#F2B544" }}>
              {STATE_LABEL[activeMatch.state].label}
            </span>
          </div>

          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "rgba(255,253,247,.07)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#8FBCB0" }}>{teamName(activeMatch.a)}</div>
              <div style={{ fontSize: 11, color: "#5F817A", marginTop: 3 }}>{teamPlayersLabel(activeMatch.a)}</div>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontWeight: 700, fontSize: "clamp(46px,9vw,68px)", lineHeight: 1, margin: "14px 0" }}>
                {draftA}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => bump("a", -1)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.2)",
                    background: "transparent",
                    color: "#FFFDF7",
                    fontSize: 22,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-archivo), sans-serif",
                  }}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => bump("a", 1)}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    border: "none",
                    background: "#F2B544",
                    color: "#08241E",
                    fontSize: 22,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-archivo), sans-serif",
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div style={{ background: "rgba(255,253,247,.07)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#8FBCB0" }}>{teamName(activeMatch.b)}</div>
              <div style={{ fontSize: 11, color: "#5F817A", marginTop: 3 }}>{teamPlayersLabel(activeMatch.b)}</div>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontWeight: 700, fontSize: "clamp(46px,9vw,68px)", lineHeight: 1, margin: "14px 0" }}>
                {draftB}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => bump("b", -1)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.2)",
                    background: "transparent",
                    color: "#FFFDF7",
                    fontSize: 22,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-archivo), sans-serif",
                  }}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => bump("b", 1)}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    border: "none",
                    background: "#F2B544",
                    color: "#08241E",
                    fontSize: 22,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-archivo), sans-serif",
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void commit("live");
              }}
              style={{
                flex: 1,
                minWidth: 150,
                height: 50,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.22)",
                background: "transparent",
                color: "#FFFDF7",
                fontSize: 14,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
                fontFamily: "var(--font-archivo), sans-serif",
              }}
            >
              Lưu tỉ số đang đấu
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void commit("done");
              }}
              style={{
                flex: 1,
                minWidth: 150,
                height: 50,
                borderRadius: 12,
                border: "none",
                background: "#3FBF8F",
                color: "#052D22",
                fontSize: 14,
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
                fontFamily: "var(--font-archivo), sans-serif",
              }}
            >
              Kết thúc trận
            </button>
          </div>
          <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#5F817A" }}>
            {savedMsg}
          </div>
        </div>
      </div>
    </div>
  );
}
