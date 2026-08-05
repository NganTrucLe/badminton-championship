"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import type { Json } from "@/lib/supabase/database.types";
import { mergeRewards, type IReward } from "@/lib/tournament/reward";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      <h2 className="m-0 mb-4 font-[family-name:var(--font-bricolage)] text-[28px] font-black">Phần thưởng</h2>
      <div className="flex flex-col gap-3">
        {rewards.map((r) => (
          <Card
            key={r.place}
            className="flex-row flex-wrap items-center gap-3 rounded-[14px] border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-3.5 py-3.5"
          >
            <span className="text-2xl">{r.medal}</span>
            <Input
              value={r.title}
              onChange={(e) => edit(r.place, "title", e.target.value)}
              placeholder="Tiêu đề phần thưởng"
              className="h-10 min-w-[200px] flex-[2]"
            />
            <Input
              value={r.detail}
              onChange={(e) => edit(r.place, "detail", e.target.value)}
              placeholder="Chi tiết"
              className="h-10 min-w-[140px] flex-1"
            />
          </Card>
        ))}
      </div>
      <Button
        type="button"
        variant="success"
        disabled={busy}
        onClick={() => void save()}
        className="mt-4 h-[46px] rounded-xl px-6 font-[family-name:var(--font-archivo)] text-sm font-extrabold"
      >
        {busy ? <Loader2 className="animate-spin" /> : <Save />}
        Lưu phần thưởng
      </Button>
      {msg && <div className="mt-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-[#5F817A]">{msg}</div>}
    </div>
  );
}
