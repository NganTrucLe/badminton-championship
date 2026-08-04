"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import type { Json } from "@/lib/supabase/database.types";
import { mergeRewards, type IReward } from "@/lib/tournament/reward";

export function RewardsEditor({ initialRewards }: { initialRewards: IReward[] }) {
  const [rewards, setRewards] = useState(initialRewards);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function edit(place: number, field: "title" | "detail", value: string) {
    setRewards((prev) => prev.map((r) => (r.place === place ? { ...r, [field]: value } : r)));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const supabase = createBrowserSupabaseClient();
      const payload = mergeRewards(rewards);
      const { data, error } = await supabase
        .from("tournament")
        .update({ rewards: payload as unknown as Json })
        .eq("id", true)
        .select();
      if (error) return setMsg(`Lỗi: ${error.message}`);
      if (!data || data.length === 0) return setMsg("Không có quyền quản trị.");
      setMsg("Đã lưu phần thưởng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>
        Phần thưởng
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rewards.map((r) => (
          <div key={r.place} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 14, padding: 14 }}>
            <span style={{ fontSize: 24 }}>{r.medal}</span>
            <input
              value={r.title}
              onChange={(e) => edit(r.place, "title", e.target.value)}
              placeholder="Tiêu đề phần thưởng"
              style={{ flex: 2, minWidth: 200, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            />
            <input
              value={r.detail}
              onChange={(e) => edit(r.place, "detail", e.target.value)}
              placeholder="Chi tiết"
              style={{ flex: 1, minWidth: 140, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        style={{ marginTop: 16, height: 46, padding: "0 24px", borderRadius: 12, border: "none", background: "#3FBF8F", color: "#052D22", fontWeight: 800, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
      >
        Lưu phần thưởng
      </button>
      {msg && <div style={{ marginTop: 12, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
