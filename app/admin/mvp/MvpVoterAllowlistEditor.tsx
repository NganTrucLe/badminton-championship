"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  addMvpVoter, getMvpVoterAllowlist, listSystemUsers, removeMvpVoter,
} from "@/lib/supabase/mvpClient";
import type { ISystemUser } from "@/lib/tournament/mvp";

export function MvpVoterAllowlistEditor({ disabled }: { disabled: boolean }) {
  const [users, setUsers] = useState<ISystemUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [list, emails] = await Promise.all([listSystemUsers(), getMvpVoterAllowlist()]);
        setUsers(list);
        setSelected(new Set(emails));
      } catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    })();
  }, []);

  async function toggle(email: string, on: boolean) {
    setBusyEmail(email); setMsg(null);
    try {
      if (on) {
        const res = await addMvpVoter(email);
        if (res === "denied") { setMsg("Không có quyền quản trị."); return; }
        setSelected((prev) => new Set(prev).add(email));
      } else {
        await removeMvpVoter(email);
        setSelected((prev) => { const n = new Set(prev); n.delete(email); return n; });
      }
    } catch (e) { setMsg(`Lỗi: ${(e as Error).message}`); }
    finally { setBusyEmail(null); }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-bricolage)] text-lg">Người bình chọn</h3>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-muted-foreground">
          {selected.size}/16
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Người dùng chỉ hiện ở đây sau khi đã đăng nhập ít nhất một lần.
      </p>
      <ul className="flex flex-col gap-2">
        {users.map((u) => {
          const email = u.email.toLowerCase();      // allow-list stores lower-cased emails
          const on = selected.has(email);
          const pending = busyEmail === email;
          return (
            <li key={u.id}>
              <Card className="flex-row items-center gap-3 rounded-[14px] p-3">
                <Avatar>
                  {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name ?? email} />}
                  <AvatarFallback>{(u.name ?? email).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-sm">{u.name ?? "(chưa có tên)"}</strong>
                  <span className="truncate font-[family-name:var(--font-jetbrains)] text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </div>
                <Button size="sm" variant={on ? "success" : "outline"}
                  disabled={disabled || pending} onClick={() => void toggle(email, !on)}>
                  {pending ? <Loader2 className="animate-spin" /> : on ? <Check /> : <Plus />}
                  {on ? "Đã chọn" : "Chọn"}
                </Button>
              </Card>
            </li>
          );
        })}
        {users.length === 0 && (
          <li className="text-sm text-muted-foreground">Chưa có người dùng nào đăng nhập.</li>
        )}
      </ul>
      {disabled && <p className="text-xs text-muted-foreground">Không thể sửa khi đang bình chọn.</p>}
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </section>
  );
}
