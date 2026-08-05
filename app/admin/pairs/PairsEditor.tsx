"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { validatePairAssignment } from "@/lib/tournament/adminValidation";
import type { IAdminPair, IAdminPlayer } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      <h2 className="m-0 mb-4 font-[family-name:var(--font-bricolage)] text-[28px] font-black">Cặp đấu</h2>
      {!editable && (
        <Alert className="mb-4 border-[#F2B544] bg-[rgba(242,181,68,.16)]">
          <AlertDescription className="text-[13px] text-inherit">
            Giải đang diễn ra — đội hình đã khoá. Đặt lại giải để chỉnh sửa.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2.5">
        {pairs.map((pair) => (
          <Card
            key={pair.id}
            className="flex-row flex-wrap items-center gap-3 rounded-[14px] border-[rgba(10,31,26,.12)] bg-[#FFFDF7] p-3.5 py-3.5 gap-y-3"
          >
            <Badge
              variant="outline"
              className="w-6 justify-center rounded-none border-none bg-transparent p-0 font-[family-name:var(--font-jetbrains)] font-bold text-[#0B5D4E]"
            >
              {pair.code}
            </Badge>
            {(["player1Id", "player2Id"] as const).map((slot) => (
              <Select
                key={slot}
                defaultValue={pair[slot]}
                onValueChange={(value) => void savePair(pair, { [slot]: value } as Partial<IAdminPair>)}
                disabled={!editable}
              >
                <SelectTrigger className="h-10 min-w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            <Input
              defaultValue={pair.name}
              disabled={!editable}
              onBlur={(e) => {
                if (e.target.value.trim() !== pair.name) void savePair(pair, { name: e.target.value.trim() });
              }}
              className="h-10 min-w-[160px] flex-1"
            />
          </Card>
        ))}
      </div>
      {msg && <div className="mt-3.5 font-[family-name:var(--font-jetbrains)] text-[11px] text-[#5F817A]">{msg}</div>}
    </div>
  );
}
