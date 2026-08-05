"use client";

import { useMemo, useState } from "react";
import { Loader2, Minus, Plus, Play, Square } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useLiveMatches } from "@/lib/supabase/useLiveMatches";
import { getTeam, teamName, type IMatch, type TMatchState } from "@/lib/tournament/data";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [resetError, setResetError] = useState<string>("");

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
        setResetError(`Lỗi khi đặt lại: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        setSavedMsg("Không thể đặt lại: tài khoản này không có quyền, hoặc giải chưa bắt đầu.");
        setResetError("Không thể đặt lại: tài khoản này không có quyền, hoặc giải chưa bắt đầu.");
        return;
      }
      setMatches((prev) => prev.map((m) => (m.id === activeMatch.id ? { ...m, sa: 0, sb: 0, state: "next" } : m)));
      setConfirmingReset(false);
      setSelectedId("");
      setSavedMsg("Đã đặt lại trận.");
      setResetError("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-[14px]">
        <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[clamp(28px,4vw,44px)] font-black tracking-[-.035em]">
          Cập nhật tỉ số
        </h2>
      </div>

      <div className="mt-[22px] grid grid-cols-1 items-start gap-4">
        <Card className="gap-0 rounded-[20px] border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-5">
          <div className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#5B7A72]">
            CHỌN TRẬN
          </div>
          <div className="mt-3">
            <RefereeSwissPicker
              matches={matches}
              activeId={activeMatch?.id ?? ""}
              liveMatchId={liveMatch?.id ?? null}
              onSelect={selectMatch}
            />
          </div>
        </Card>

        <Card className="col-span-1 gap-0 rounded-[20px] border-0 bg-[#0A1F1A] p-[clamp(20px,3vw,30px)] text-[#FFFDF7]">
          {!activeMatch ? (
            <div className="px-[10px] py-10 text-center font-[family-name:var(--font-archivo)] text-[15px] font-bold text-[#8FBCB0]">
              Chọn một trận để bắt đầu
            </div>
          ) : (
            <>
              <div className="flex items-center gap-[10px]">
                <Badge
                  className="ml-auto rounded-full bg-[#F2B544]/15 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.12em] text-[#F2B544]"
                >
                  {STATE_LABEL[activeMatch.state].label}
                </Badge>
              </div>

              <div className="mt-[22px] grid grid-cols-2 gap-[14px]">
                <div
                  className="rounded-2xl p-[18px] text-center"
                  style={{
                    background: activeWinner === "a" ? "rgba(63,191,143,.14)" : "rgba(255,253,247,.07)",
                    border: activeWinner === "a" ? "1px solid #3FBF8F" : "1px solid rgba(255,255,255,.14)",
                  }}
                >
                  <div className="mb-2 flex justify-center gap-1">
                    {getTeam(activeMatch.a).players.map((p) => (
                      <PlayerAvatar key={p.name} player={p} size={30} />
                    ))}
                  </div>
                  <div
                    className="text-[14px]"
                    style={{ fontWeight: activeWinner === "a" ? 900 : 800, color: activeWinner === "a" ? "#FFFDF7" : "#8FBCB0" }}
                  >
                    {teamName(activeMatch.a)}
                  </div>
                  <div
                    data-testid="ref-score-a"
                    className="my-[14px] font-[family-name:var(--font-jetbrains)] text-[clamp(46px,9vw,68px)] leading-none"
                    style={{ fontWeight: activeWinner === "a" ? 900 : 700, color: activeWinner === "a" ? "#3FBF8F" : "#FFFDF7" }}
                  >
                    {draftA}
                  </div>
                  {showScoreControls(activeMatch.state) && (
                    <div className="flex justify-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Giảm điểm đội A"
                        onClick={() => bump("a", -1)}
                        className="size-12 rounded-xl border border-white/20 bg-transparent text-[#FFFDF7] hover:bg-white/10"
                      >
                        <Minus />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Tăng điểm đội A"
                        onClick={() => bump("a", 1)}
                        className="size-12 rounded-xl bg-[#F2B544] text-[#08241E] hover:bg-[#F2B544]/90"
                      >
                        <Plus />
                      </Button>
                    </div>
                  )}
                </div>
                <div
                  className="rounded-2xl p-[18px] text-center"
                  style={{
                    background: activeWinner === "b" ? "rgba(63,191,143,.14)" : "rgba(255,253,247,.07)",
                    border: activeWinner === "b" ? "1px solid #3FBF8F" : "1px solid rgba(255,255,255,.14)",
                  }}
                >
                  <div className="mb-2 flex justify-center gap-1">
                    {getTeam(activeMatch.b).players.map((p) => (
                      <PlayerAvatar key={p.name} player={p} size={30} />
                    ))}
                  </div>
                  <div
                    className="text-[14px]"
                    style={{ fontWeight: activeWinner === "b" ? 900 : 800, color: activeWinner === "b" ? "#FFFDF7" : "#8FBCB0" }}
                  >
                    {teamName(activeMatch.b)}
                  </div>
                  <div
                    data-testid="ref-score-b"
                    className="my-[14px] font-[family-name:var(--font-jetbrains)] text-[clamp(46px,9vw,68px)] leading-none"
                    style={{ fontWeight: activeWinner === "b" ? 900 : 700, color: activeWinner === "b" ? "#3FBF8F" : "#FFFDF7" }}
                  >
                    {draftB}
                  </div>
                  {showScoreControls(activeMatch.state) && (
                    <div className="flex justify-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Giảm điểm đội B"
                        onClick={() => bump("b", -1)}
                        className="size-12 rounded-xl border border-white/20 bg-transparent text-[#FFFDF7] hover:bg-white/10"
                      >
                        <Minus />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Tăng điểm đội B"
                        onClick={() => bump("b", 1)}
                        className="size-12 rounded-xl bg-[#F2B544] text-[#08241E] hover:bg-[#F2B544]/90"
                      >
                        <Plus />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-[10px]">
                {primaryAction(activeMatch.state) === "start" && (
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      void commit("live");
                    }}
                    className="h-[50px] min-w-[150px] flex-1 rounded-xl bg-[#0B5D4E] font-[family-name:var(--font-archivo)] text-[14px] font-extrabold text-[#FFFDF7] hover:bg-[#0B5D4E]/90"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Play />}
                    Bắt đầu trận
                  </Button>
                )}
                {primaryAction(activeMatch.state) === "end" && (
                  <>
                    <Button
                      type="button"
                      variant="success"
                      disabled={saving}
                      onClick={() => {
                        void commit("done");
                      }}
                      className="h-[50px] min-w-[150px] flex-1 rounded-xl font-[family-name:var(--font-archivo)] text-[14px] font-extrabold"
                    >
                      {saving ? <Loader2 className="animate-spin" /> : <Square />}
                      Kết thúc trận
                    </Button>
                    <AlertDialog
                      open={confirmingReset}
                      onOpenChange={(open) => {
                        setConfirmingReset(open);
                        if (open) setResetError("");
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="dangerOutline"
                          disabled={saving}
                          className="h-[50px] min-w-[130px] rounded-xl font-[family-name:var(--font-archivo)] text-[14px] font-extrabold"
                        >
                          Đặt lại trận
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Đặt lại trận?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Đưa trận về “sắp diễn ra” với tỉ số 0–0. Chỉ dùng để sửa lỗi.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        {resetError && <p className="text-destructive text-[12px] mt-2">{resetError}</p>}
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={saving}>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            variant="danger"
                            disabled={saving}
                            onClick={(e) => {
                              e.preventDefault();
                              void resetMatch();
                            }}
                          >
                            Xác nhận đặt lại
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                {activeMatch.state === "done" && (
                  <div className="font-[family-name:var(--font-archivo)] text-[13px] text-[#8FBCB0]">
                    Chọn trận tiếp theo để tiếp tục
                  </div>
                )}
              </div>
              <Alert className="mt-3 border-white/10 bg-white/[.04] px-3 py-2">
                <AlertDescription className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[#5F817A]">
                  {savedMsg}
                </AlertDescription>
              </Alert>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
