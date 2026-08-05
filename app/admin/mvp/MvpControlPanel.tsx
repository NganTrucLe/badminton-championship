"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Countdown } from "@/components/Countdown";
import { useMvpTurnout } from "@/lib/supabase/useMvpTurnout";
import { closeMvpVote, openMvpVote, resetMvpVote } from "@/lib/supabase/mvpClient";
import type { IMvpStatus } from "@/lib/tournament/mvp";

export function MvpControlPanel({ initial }: { initial: IMvpStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(10);
  const { votedCount, totalEligible } = useMvpTurnout(initial.votedCount, initial.totalEligible);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { await action(); router.refresh(); }
    catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  if (initial.status === "open") {
    return (
      <Card className="gap-4 p-6">
        <h2 className="font-[family-name:var(--font-bricolage)] text-xl">Đang bình chọn</h2>
        <p className="font-[family-name:var(--font-jetbrains)] text-3xl font-bold text-primary">
          {votedCount} / {totalEligible}{" "}
          <span className="text-base font-normal text-muted-foreground">đã bình chọn</span>
        </p>
        {initial.deadline && <Countdown target={initial.deadline} />}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="dangerOutline" disabled={busy} className="w-fit">
              {busy ? <Loader2 className="animate-spin" /> : <Square />} Kết thúc bình chọn
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kết thúc bình chọn?</AlertDialogTitle>
              <AlertDialogDescription>
                Kết quả sẽ hiển thị công khai ngay lập tức và không thể mở lại đợt này.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant="danger" onClick={() => void run(closeMvpVote)}>Kết thúc</Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </Card>
    );
  }

  if (initial.status === "closed") {
    return (
      <Card className="gap-4 p-6">
        <h2 className="font-[family-name:var(--font-bricolage)] text-xl">Bình chọn đã kết thúc</h2>
        <p className="text-muted-foreground">Kết quả đã hiển thị công khai trên trang chủ.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="dangerOutline" disabled={busy} className="w-fit">
              {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Đặt lại để bình chọn mới
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Đặt lại bình chọn MVP?</AlertDialogTitle>
              <AlertDialogDescription>
                Kết quả hiện tại sẽ bị xóa và không thể khôi phục. Một đợt bình chọn mới sẽ bắt đầu từ đầu.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant="danger" onClick={() => void run(resetMvpVote)}>Đặt lại</Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </Card>
    );
  }

  // idle
  return (
    <Card className="gap-4 p-6">
      <h2 className="font-[family-name:var(--font-bricolage)] text-xl">Bắt đầu bình chọn MVP</h2>
      <p className="text-sm text-muted-foreground">
        Chỉ những người trong danh sách bên dưới mới có thể bình chọn.
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="mvp-minutes">Thời gian (phút)</Label>
        <Input id="mvp-minutes" type="number" min={1} value={minutes} disabled={busy}
          onChange={(e) => setMinutes(Number(e.target.value))} className="h-10 w-32" />
      </div>
      <Button variant="success" disabled={busy || minutes < 1} className="w-fit"
        onClick={() => void run(() => openMvpVote(minutes))}>
        {busy ? <Loader2 className="animate-spin" /> : <Play />} Mở bình chọn
      </Button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </Card>
  );
}
