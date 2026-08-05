"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/brand/GoogleIcon";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { castMvpVote } from "@/lib/supabase/mvpClient";
import { cn } from "@/lib/utils";
import type { IMvpCandidate, IMvpStatus } from "@/lib/tournament/mvp";

function CandidateGrid({
  list,
  sel,
  onSel,
  title,
}: {
  list: IMvpCandidate[];
  sel: string | null;
  onSel: (id: string) => void;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-[family-name:var(--font-bricolage)] text-lg">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSel(c.id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-2 transition-transform hover:-translate-y-0.5",
              sel === c.id
                ? "border-primary bg-cream ring-2 ring-primary"
                : "border-border bg-card",
            )}
          >
            <PlayerAvatar
              player={{
                name: c.name,
                tier: c.tier,
                avatarKey: c.avatarKey ?? undefined,
                avatarUrl: c.avatarUrl ?? undefined,
              }}
              size={56}
            />
            <span className="text-center text-sm">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function VoteFlow({
  status,
  male,
  female,
}: {
  status: IMvpStatus;
  male: IMvpCandidate[];
  female: IMvpCandidate[];
}) {
  const { user, loading, signInWithGoogle } = useRefereeAuth();
  const [phase, setPhase] = useState<"pick" | "done">("pick");
  const [maleId, setMaleId] = useState<string | null>(null);
  const [femaleId, setFemaleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status.status === "idle")
    return <p className="text-muted-foreground">Chưa có đợt bình chọn nào.</p>;
  if (status.status === "closed")
    return (
      <p className="text-muted-foreground">
        Bình chọn đã kết thúc.{" "}
        <Link href="/" className="text-primary underline">
          Xem kết quả
        </Link>
        .
      </p>
    );

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;

  if (!user) {
    async function handleSignIn() {
      if (signingIn) return;
      setSigningIn(true);
      try {
        await signInWithGoogle("/vote");
      } catch (e) {
        setMsg(`Lỗi: ${(e as Error).message}`);
        setSigningIn(false);
      }
    }
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-fit gap-2"
          disabled={signingIn}
          onClick={() => void handleSignIn()}
        >
          {signingIn ? <Loader2 className="animate-spin" /> : <GoogleIcon size={16} />}
          Đăng nhập bằng Google để bình chọn
        </Button>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </div>
    );
  }

  if (!status.isEligible)
    return (
      <p className="text-muted-foreground">
        Tài khoản của bạn không có trong danh sách bình chọn.
      </p>
    );

  if (status.hasVoted || phase === "done")
    return <p className="text-lg font-semibold text-primary">Bạn đã bình chọn. Cảm ơn! 🏸</p>;

  async function submit() {
    if (!maleId || !femaleId) {
      setMsg("Hãy chọn 1 nam và 1 nữ.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await castMvpVote(maleId, femaleId);
      setPhase("done");
    } catch (e) {
      setMsg(`Lỗi: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <CandidateGrid list={male} sel={maleId} onSel={setMaleId} title="MVP Nam" />
      <CandidateGrid list={female} sel={femaleId} onSel={setFemaleId} title="MVP Nữ" />
      <Button
        variant="success"
        className="w-fit"
        disabled={busy || !maleId || !femaleId}
        onClick={() => void submit()}
      >
        {busy ? <Loader2 className="animate-spin" /> : null} Gửi bình chọn
      </Button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
