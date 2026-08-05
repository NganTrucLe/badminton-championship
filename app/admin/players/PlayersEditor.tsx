"use client";

import { useState } from "react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { validatePlayerName, validateTier } from "@/lib/tournament/adminValidation";
import type { IAdminPlayer } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      <h2 className="m-0 mb-4 font-[family-name:var(--font-bricolage)] text-[28px] font-black">Vận động viên</h2>
      {!editable && (
        <Alert className="mb-4 border-[#F2B544] bg-[rgba(242,181,68,.16)]">
          <AlertDescription className="text-[13px] text-inherit">
            Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2.5">
        {players.map((p) => (
          <Card
            key={p.id}
            className="flex-row flex-wrap items-center gap-3.5 rounded-[14px] border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-3.5 py-3.5"
          >
            <AvatarUpload
              playerId={p.id}
              currentUrl={p.avatarUrl ?? (p.avatarKey ? `/avatars/${p.avatarKey}.jpg` : null)}
              onUploaded={(url) => void patch(p.id, { avatar_url: url })}
              disabled={!editable}
            />
            <Input
              defaultValue={p.name}
              disabled={!editable}
              onBlur={(e) => {
                const err = validatePlayerName(e.target.value);
                if (err) return setMsg(err);
                if (e.target.value.trim() !== p.name) void patch(p.id, { name: e.target.value.trim() });
              }}
              className="h-10 min-w-[160px] flex-1"
            />
            <Select
              defaultValue={String(p.tier)}
              onValueChange={(value) => {
                const tier = Number(value);
                if (validateTier(tier)) void patch(p.id, { tier });
              }}
              disabled={!editable}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    Bậc {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        ))}
      </div>
      {msg && <div className="mt-3.5 font-[family-name:var(--font-jetbrains)] text-[11px] text-[#5F817A]">{msg}</div>}
    </div>
  );
}
