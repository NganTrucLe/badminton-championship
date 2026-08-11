"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { regenerateRoundOne } from "@/app/admin/regenerateRoundOne";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const STATUS_LABEL: Record<string, string> = {
  setup: "ĐANG THIẾT LẬP",
  live: "ĐANG DIỄN RA",
  done: "ĐÃ KẾT THÚC",
};

export function LifecyclePanel({
  initialStatus,
  rosterError,
}: {
  initialStatus: "setup" | "live" | "done";
  rosterError?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      // 1) Rebuild round-1 matches from the current đội hình (only allowed in setup).
      const regen = await regenerateRoundOne();
      if (!regen.ok) {
        setMsg(`Không thể xếp lịch: ${regen.error}`);
        return;
      }
      // 2) Lock the roster and go live.
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("start_tournament");
      if (error) {
        setMsg(`Không thể bắt đầu: ${error.message}`);
        return;
      }
      setStatus("live");
      setMsg("Đã xếp lịch vòng 1, khoá đội hình và bắt đầu giải đấu.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("reset_tournament");
      if (error) {
        setMsg(`Không thể đặt lại: ${error.message}`);
        return;
      }
      setStatus("setup");
      setOpen(false);
      setMsg("Đã đặt lại toàn bộ tỉ số. Giải trở về trạng thái thiết lập.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const startDisabled = busy || status !== "setup" || !!rosterError;

  return (
    <Card className="gap-0 rounded-[20px] border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[28px] font-black">
          Điều khiển giải đấu
        </h2>
        <span className="ml-auto font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[.14em] text-[#0B5D4E]">
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-3 text-sm text-[#5B7A72]">
        Ở trạng thái “thiết lập”, bạn có thể sửa vận động viên và cặp đấu. Bấm bắt đầu để khoá đội hình và cho phép chấm điểm.
      </p>
      <Button
        type="button"
        variant="success"
        disabled={startDisabled}
        onClick={() => void start()}
        className={cn(
          "mt-2 h-12 rounded-xl px-6 font-[family-name:var(--font-archivo)] text-sm font-extrabold",
          startDisabled ? "cursor-not-allowed" : "cursor-pointer",
          startDisabled &&
            "bg-[rgba(10,31,26,.12)] text-[#8AA39C] hover:bg-[rgba(10,31,26,.12)] cursor-not-allowed"
        )}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Play />}
        Gửi đội hình & bắt đầu giải
      </Button>
      {status === "setup" && rosterError && (
        <div className="mt-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-[#B0435F]">
          {rosterError}
        </div>
      )}
      {msg && (
        <div className="mt-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-[#5F817A]">
          {msg}
        </div>
      )}
      <div className="mt-6 border-t border-[rgba(10,31,26,.1)] pt-5">
        <div className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#B0435F]">
          VÙNG NGUY HIỂM
        </div>
        <p className="mt-2 text-[13px] text-[#5B7A72]">
          Đặt lại sẽ xoá toàn bộ tỉ số và đưa mọi trận về “sắp diễn ra”. Vận động viên và cặp đấu được giữ nguyên.
        </p>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="dangerOutline"
              disabled={busy}
              className="mt-2 h-11 rounded-xl px-5 font-[family-name:var(--font-archivo)] text-[13px] font-extrabold"
            >
              <RotateCcw />
              Đặt lại giải đấu…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Đặt lại giải đấu?</AlertDialogTitle>
              <AlertDialogDescription>
                Đặt lại sẽ xoá toàn bộ tỉ số và đưa mọi trận về “sắp diễn ra”. Vận động viên và cặp đấu được giữ nguyên.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
              <AlertDialogAction
                variant="danger"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  void reset();
                }}
              >
                Xác nhận đặt lại — không thể hoàn tác
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
