"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

const STATUS_LABEL: Record<string, string> = {
  setup: "ĐANG THIẾT LẬP",
  live: "ĐANG DIỄN RA",
  done: "ĐÃ KẾT THÚC",
};

export function LifecyclePanel({ initialStatus }: { initialStatus: "setup" | "live" | "done" }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
        disabled={busy || status !== "setup"}
        onClick={() => void start()}
        style={{
          marginTop: 8,
          height: 48,
          padding: "0 24px",
          borderRadius: 12,
          border: "none",
          background: status === "setup" ? "#3FBF8F" : "rgba(10,31,26,.12)",
          color: status === "setup" ? "#052D22" : "#8AA39C",
          fontWeight: 800,
          fontSize: 14,
          cursor: busy || status !== "setup" ? "not-allowed" : "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
        }}
      >
        Gửi đội hình & bắt đầu giải
      </button>
      {msg && <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
