"use client";

import { useState } from "react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { validatePlayerName, validateTier } from "@/lib/tournament/adminValidation";
import type { IAdminPlayer } from "@/lib/supabase/admin";

export function PlayersEditor({ initialPlayers, editable }: { initialPlayers: IAdminPlayer[]; editable: boolean }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [msg, setMsg] = useState("");

  async function patch(id: string, patch: Partial<{ name: string; tier: number; avatar_url: string }>) {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.from("players").update(patch).eq("id", id).select();
    if (error) return setMsg(`Lỗi: ${error.message}`);
    if (!data || data.length === 0) return setMsg("Không có quyền, hoặc giải không ở trạng thái thiết lập.");
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...toLocal(patch) } : p)));
    setMsg("Đã lưu.");
  }

  function toLocal(patch: Partial<{ name: string; tier: number; avatar_url: string }>): Partial<IAdminPlayer> {
    return {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.tier !== undefined ? { tier: patch.tier as IAdminPlayer["tier"] } : {}),
      ...(patch.avatar_url !== undefined ? { avatarUrl: patch.avatar_url } : {}),
    };
  }

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>
        Vận động viên
      </h2>
      {!editable && (
        <div style={{ background: "rgba(242,181,68,.16)", border: "1px solid #F2B544", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
          Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 14, padding: 14 }}>
            <AvatarUpload
              playerId={p.id}
              currentUrl={p.avatarUrl ?? (p.avatarKey ? `/avatars/${p.avatarKey}.jpg` : null)}
              onUploaded={(url) => void patch(p.id, { avatar_url: url })}
            />
            <input
              defaultValue={p.name}
              disabled={!editable}
              onBlur={(e) => {
                const err = validatePlayerName(e.target.value);
                if (err) return setMsg(err);
                if (e.target.value.trim() !== p.name) void patch(p.id, { name: e.target.value.trim() });
              }}
              style={{ flex: 1, minWidth: 160, height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px", fontFamily: "var(--font-archivo), sans-serif" }}
            />
            <select
              defaultValue={p.tier}
              disabled={!editable}
              onChange={(e) => {
                const tier = Number(e.target.value);
                if (validateTier(tier)) void patch(p.id, { tier });
              }}
              style={{ height: 40, borderRadius: 10, border: "1px solid rgba(10,31,26,.18)", padding: "0 12px" }}
            >
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>Bậc {t}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {msg && <div style={{ marginTop: 14, fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#5F817A" }}>{msg}</div>}
    </div>
  );
}
