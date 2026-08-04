"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

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
  const [confirming, setConfirming] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("start_tournament");
      if (error) {
        setMsg(`Không thể bắt đầu: ${error.message}`);
        return;
      }
      setStatus("live");
      setMsg("Đã khoá đội hình và bắt đầu giải đấu.");
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
      setConfirming(false);
      setMsg("Đã đặt lại toàn bộ tỉ số. Giải trở về trạng thái thiết lập.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 20, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900 }}>
          Điều khiển giải đấu
        </h2>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, letterSpacing: ".14em", color: "#0B5D4E" }}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p style={{ color: "#5B7A72", fontSize: 14, marginTop: 12 }}>
        Ở trạng thái “thiết lập”, bạn có thể sửa vận động viên và cặp đấu. Bấm bắt đầu để khoá đội hình và cho phép chấm điểm.
      </p>
      <button
        type="button"
        disabled={busy || status !== "setup" || !!rosterError}
        onClick={() => void start()}
        style={{
          marginTop: 8,
          height: 48,
          padding: "0 24px",
          borderRadius: 12,
          border: "none",
          background: status === "setup" && !rosterError ? "#3FBF8F" : "rgba(10,31,26,.12)",
          color: status === "setup" && !rosterError ? "#052D22" : "#8AA39C",
          fontWeight: 800,
          fontSize: 14,
          cursor: busy || status !== "setup" || !!rosterError ? "not-allowed" : "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
        }}
      >
        Gửi đội hình & bắt đầu giải
      </button>
      {status === "setup" && rosterError && (
        <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#B0435F" }}>
          {rosterError}
        </div>
      )}
      {msg && <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(10,31,26,.1)" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, letterSpacing: ".16em", color: "#B0435F" }}>
          VÙNG NGUY HIỂM
        </div>
        <p style={{ color: "#5B7A72", fontSize: 13, marginTop: 8 }}>
          Đặt lại sẽ xoá toàn bộ tỉ số và đưa mọi trận về “sắp diễn ra”. Vận động viên và cặp đấu được giữ nguyên.
        </p>
        {!confirming ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            style={{ marginTop: 8, height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid #B0435F", background: "transparent", color: "#B0435F", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
          >
            Đặt lại giải đấu…
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void reset()}
              style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: "#B0435F", color: "#FFFDF7", fontWeight: 800, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              Xác nhận đặt lại — không thể hoàn tác
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid rgba(10,31,26,.18)", background: "transparent", color: "#3C5A53", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              Huỷ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
