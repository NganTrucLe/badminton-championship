"use client";

import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useLiveMatches } from "@/lib/supabase/useLiveMatches";
import { getTeam, teamName, type IMatch, type TMatchState } from "@/lib/tournament/data";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ensureNextRound } from "./ensureNextRound";
import { isSelectable, matchWinnerSide, primaryAction, showScoreControls } from "./refereeControls";
import { RefereeSwissPicker } from "./RefereeSwissPicker";

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  done: { label: "KẾT THÚC", color: "#8AA39C" },
  live: { label: "ĐANG ĐẤU", color: "#FF5A47" },
  next: { label: "SẮP DIỄN RA", color: "#0B5D4E" },
};

interface IRefereeScoringPanelProps {
  initialMatches: IMatch[];
  pairIdToTeamId: Record<string, number>;
}

/**
 * Only ever rendered server-side after `getOrganizerSession()` confirms `isOrganizer === true`
 * (see app/admin/referee/page.tsx) — the actual write-authorization boundary is the DB RLS policy
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
  const [matches, setMatches] = useLiveMatches(initialMatches, pairIdToTeamId);

  const liveMatch = useMemo(() => matches.find((m) => m.state === "live"), [matches]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirmingReset, setConfirmingReset] = useState(false);

  // When a match is live, the referee is locked to it. Otherwise, the selected 'next' match (if any).
  const activeMatch = useMemo(() => {
    if (liveMatch) return liveMatch;
    return matches.find((m) => m.id === selectedId);
  }, [liveMatch, matches, selectedId]);

  const activeWinner = activeMatch ? matchWinnerSide(activeMatch.state, activeMatch.sa, activeMatch.sb) : null;

  const [draftA, setDraftA] = useState<number>(() => activeMatch?.sa ?? 0);
  const [draftB, setDraftB] = useState<number>(() => activeMatch?.sb ?? 0);
  const [savedMsg, setSavedMsg] = useState<string>("Mọi thay đổi hiển thị ngay trên trang chủ.");
  const [saving, setSaving] = useState(false);

  // Sync drafts from the active match only when the active match ID changes — not on every
  // realtime tick — so in-progress ± taps aren't clobbered by echoed score updates. Adjusted
  // during render (React's documented pattern for "state derived from a changed prop/value")
  // rather than in a useEffect, to avoid the extra render pass a post-commit effect would cause.
  const [syncedMatchId, setSyncedMatchId] = useState<string | undefined>(activeMatch?.id);
  if (activeMatch?.id !== syncedMatchId) {
    setSyncedMatchId(activeMatch?.id);
    setDraftA(activeMatch?.sa ?? 0);
    setDraftB(activeMatch?.sb ?? 0);
  }

  function selectMatch(id: string) {
    if (liveMatch) return; // locked to the live match
    const m = matches.find((x) => x.id === id);
    if (!m || !isSelectable(m, liveMatch)) return;
    setSelectedId(id);
    setConfirmingReset(false);
    setSavedMsg("Đang chỉnh trận đã chọn.");
  }

  /**
   * Optimistic bump with immediate write to Supabase. Computes the new value,
   * updates local state immediately, and fires a background write. On error,
   * rolls back to the last server-confirmed value (activeMatch.sa/sb).
   */
  function bump(side: "a" | "b", delta: number) {
    if (side === "a") {
      const newVal = Math.max(0, draftA + delta);
      setDraftA(newVal);
      void commitLive(newVal, draftB);
    } else {
      const newVal = Math.max(0, draftB + delta);
      setDraftB(newVal);
      void commitLive(draftA, newVal);
    }
  }

  /**
   * Persists a live score immediately (triggered by ± taps). Writes to `public.matches` with
   * `state: 'live'` via the authenticated browser client, with the same RLS guard as `commit()`.
   * On error (including RLS rejection), rolls back local state to the last server-confirmed values
   * from activeMatch.
   */
  async function commitLive(scoreA: number, scoreB: number) {
    if (!activeMatch || saving) return;
    setSaving(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("matches")
        .update({ score_a: scoreA, score_b: scoreB, state: "live" })
        .eq("code", activeMatch.id)
        .select();

      if (error) {
        setSavedMsg(`Lỗi khi lưu: ${error.message}`);
        setDraftA(activeMatch.sa);
        setDraftB(activeMatch.sb);
        return;
      }
      if (!data || data.length === 0) {
        setSavedMsg("Không thể lưu: tài khoản này không có quyền trọng tài.");
        setDraftA(activeMatch.sa);
        setDraftB(activeMatch.sb);
        return;
      }

      // Optimistic local patch ahead of the realtime echo
      setMatches((prev) => prev.map((m) => (m.id === activeMatch.id ? { ...m, sa: scoreA, sb: scoreB, state: "live" } : m)));
      setSavedMsg(`Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN")}`);
    } catch (err) {
      setSavedMsg(`Lỗi khi lưu: ${err instanceof Error ? err.message : String(err)}`);
      setDraftA(activeMatch.sa);
      setDraftB(activeMatch.sb);
    } finally {
      setSaving(false);
    }
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
        setSavedMsg(`Lỗi khi lưu: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        setSavedMsg("Không thể lưu: tài khoản này không có quyền trọng tài.");
        return;
      }

      // Optimistic local patch ahead of the realtime echo, so the "CHỌN TRẬN" list and state
      // badge update instantly even if the realtime round-trip lags.
      setMatches((prev) => prev.map((m) => (m.id === activeMatch.id ? { ...m, sa: draftA, sb: draftB, state } : m)));
      if (state === "done") {
        // Keep the just-ended match selected so the scoreboard stays showing its
        // final score (read-only) instead of falling back to the empty prompt.
        setSelectedId(activeMatch.id);
        // Fire-and-forget: don't block the UI. Supabase Realtime delivers the
        // generated round (if this was the round's last match) to all viewers,
        // including this panel via useLiveMatches.
        void ensureNextRound();
      }
      setSavedMsg(
        state === "done"
          ? `Đã kết thúc ${teamName(activeMatch.a)} vs ${teamName(activeMatch.b)} · ${draftA}–${draftB}`
          : `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN")}`,
      );
    } catch (err) {
      setSavedMsg(`Lỗi khi lưu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Corrective per-match reset: returns the active (live) match to `next` with score 0.
   * Reuses the same `matches` UPDATE RLS policy as `commit`/`commitLive` (organizer + live
   * state) — no new policy needed. Two-step in-panel confirm, no `window.confirm`.
   */
  async function resetMatch() {
    if (!activeMatch || saving) return;
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("matches")
        .update({ score_a: 0, score_b: 0, state: "next" })
        .eq("code", activeMatch.id)
        .select();
      if (error) {
        setSavedMsg(`Lỗi khi đặt lại: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        setSavedMsg("Không thể đặt lại: tài khoản này không có quyền, hoặc giải chưa bắt đầu.");
        return;
      }
      setMatches((prev) => prev.map((m) => (m.id === activeMatch.id ? { ...m, sa: 0, sb: 0, state: "next" } : m)));
      setConfirmingReset(false);
      setSelectedId("");
      setSavedMsg("Đã đặt lại trận.");
    } finally {
      setSaving(false);
    }
  }

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
      </div>

      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 20, padding: 20 }}>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#5B7A72" }}>
            CHỌN TRẬN
          </div>
          <div style={{ marginTop: 12 }}>
            <RefereeSwissPicker
              matches={matches}
              activeId={activeMatch?.id ?? ""}
              liveMatchId={liveMatch?.id ?? null}
              onSelect={selectMatch}
            />
          </div>
        </div>

        <div style={{ gridColumn: "span 1", background: "#0A1F1A", borderRadius: 20, padding: "clamp(20px,3vw,30px)", color: "#FFFDF7" }}>
          {!activeMatch ? (
            <div style={{ padding: "40px 10px", textAlign: "center", color: "#8FBCB0", fontFamily: "var(--font-archivo), sans-serif", fontSize: 15, fontWeight: 700 }}>
              Chọn một trận để bắt đầu
            </div>
          ) : (
            <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".12em", color: "#F2B544" }}>
              {STATE_LABEL[activeMatch.state].label}
            </span>
          </div>

          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div
              style={{
                background: activeWinner === "a" ? "rgba(63,191,143,.14)" : "rgba(255,253,247,.07)",
                border: activeWinner === "a" ? "1px solid #3FBF8F" : "1px solid rgba(255,255,255,.14)",
                borderRadius: 16,
                padding: 18,
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 8 }}>
                {getTeam(activeMatch.a).players.map((p) => (
                  <PlayerAvatar key={p.name} player={p} size={30} />
                ))}
              </div>
              <div style={{ fontSize: 14, fontWeight: activeWinner === "a" ? 900 : 800, color: activeWinner === "a" ? "#FFFDF7" : "#8FBCB0" }}>
                {teamName(activeMatch.a)}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontWeight: activeWinner === "a" ? 900 : 700,
                  fontSize: "clamp(46px,9vw,68px)",
                  lineHeight: 1,
                  margin: "14px 0",
                  color: activeWinner === "a" ? "#3FBF8F" : "#FFFDF7",
                }}
              >
                {draftA}
              </div>
              {showScoreControls(activeMatch.state) && (
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
              )}
            </div>
            <div
              style={{
                background: activeWinner === "b" ? "rgba(63,191,143,.14)" : "rgba(255,253,247,.07)",
                border: activeWinner === "b" ? "1px solid #3FBF8F" : "1px solid rgba(255,255,255,.14)",
                borderRadius: 16,
                padding: 18,
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 8 }}>
                {getTeam(activeMatch.b).players.map((p) => (
                  <PlayerAvatar key={p.name} player={p} size={30} />
                ))}
              </div>
              <div style={{ fontSize: 14, fontWeight: activeWinner === "b" ? 900 : 800, color: activeWinner === "b" ? "#FFFDF7" : "#8FBCB0" }}>
                {teamName(activeMatch.b)}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontWeight: activeWinner === "b" ? 900 : 700,
                  fontSize: "clamp(46px,9vw,68px)",
                  lineHeight: 1,
                  margin: "14px 0",
                  color: activeWinner === "b" ? "#3FBF8F" : "#FFFDF7",
                }}
              >
                {draftB}
              </div>
              {showScoreControls(activeMatch.state) && (
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
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {primaryAction(activeMatch.state) === "start" && (
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
                  border: "none",
                  background: "#0B5D4E",
                  color: "#FFFDF7",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  fontFamily: "var(--font-archivo), sans-serif",
                }}
              >
                Bắt đầu trận
              </button>
            )}
            {primaryAction(activeMatch.state) === "end" && (
              <>
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
                {!confirmingReset ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirmingReset(true)}
                    style={{
                      minWidth: 130,
                      height: 50,
                      borderRadius: 12,
                      border: "1px solid #B0435F",
                      background: "transparent",
                      color: "#B0435F",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.6 : 1,
                      fontFamily: "var(--font-archivo), sans-serif",
                    }}
                  >
                    Đặt lại trận
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-archivo), sans-serif", fontSize: 12, color: "#B0435F", fontWeight: 700 }}>
                      Chắc chắn?
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void resetMatch();
                      }}
                      style={{
                        height: 50,
                        padding: "0 16px",
                        borderRadius: 12,
                        border: "none",
                        background: "#B0435F",
                        color: "#FFFDF7",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: saving ? "not-allowed" : "pointer",
                        opacity: saving ? 0.6 : 1,
                        fontFamily: "var(--font-archivo), sans-serif",
                      }}
                    >
                      Xác nhận đặt lại
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setConfirmingReset(false)}
                      style={{
                        height: 50,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,.2)",
                        background: "transparent",
                        color: "#FFFDF7",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: saving ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-archivo), sans-serif",
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </>
            )}
            {activeMatch.state === "done" && (
              <div style={{ fontFamily: "var(--font-archivo), sans-serif", fontSize: 13, color: "#8FBCB0" }}>
                Chọn trận tiếp theo để tiếp tục
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#5F817A" }}>
            {savedMsg}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
