"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { validatePairAssignment } from "@/lib/tournament/adminValidation";
import type { IAdminPair, IAdminPlayer } from "@/lib/supabase/admin";

export function PairsEditor({
  initialPairs,
  players,
  editable,
}: {
  initialPairs: IAdminPair[];
  players: IAdminPlayer[];
  editable: boolean;
}) {
  const [pairs, setPairs] = useState(initialPairs);
  const [msg, setMsg] = useState("");

  function nameFor(id: string): string {
    return players.find((p) => p.id === id)?.name ?? "";
  }

  async function savePair(pair: IAdminPair, next: Partial<IAdminPair>) {
    const merged = { ...pair, ...next };
    const err = validatePairAssignment(merged.player1Id, merged.player2Id);
    if (err) return setMsg(err);
    const supabase = createBrowserSupabaseClient();
    const suggestedName = `${nameFor(merged.player1Id)} – ${nameFor(merged.player2Id)}`;
    const { data, error } = await supabase
      .from("pairs")
      .update({ player1_id: merged.player1Id, player2_id: merged.player2Id, name: merged.name || suggestedName })
      .eq("id", pair.id)
      .select();
    if (error) return setMsg(`Lỗi: ${error.message}`);
    if (!data || data.length === 0) return setMsg("Không có quyền, hoặc giải không ở trạng thái thiết lập.");
    setPairs((prev) => prev.map((p) => (p.id === pair.id ? { ...merged, name: merged.name || suggestedName } : p)));
    setMsg(`Đã lưu cặp ${pair.code}.`);
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>
        Cặp đấu
      </h2>
      {!editable && (
        <div style={{ background: "rgba(242,181,68,.16)", border: "1px solid #F2B544", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
          Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pairs.map((pair) => (
          <div key={pair.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 14, padding: 14 }}>
            <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontWeight: 700, width: 24, color: "#0B5D4E" }}>{pair.code}</span>
            {(["player1Id", "player2Id"] as const).map((slot) => (
              <select
                key={slot}
                defaultValue={pair[slot]}
                disabled={!editable}
                onChange={(e) => void savePair(pair, { [slot]: e.target.value } as Partial<IAdminPair>)}
                style={{ height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px", minWidth: 150 }}
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
            <input
              defaultValue={pair.name}
              disabled={!editable}
              onBlur={(e) => {
                if (e.target.value.trim() !== pair.name) void savePair(pair, { name: e.target.value.trim() });
              }}
              style={{ flex: 1, minWidth: 160, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            />
          </div>
        ))}
      </div>
      {msg && <div style={{ marginTop: 14, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
