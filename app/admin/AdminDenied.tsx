"use client";

import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface IAdminDeniedProps {
  email: string | null;
}

/**
 * Shown for a signed-in user whose email is NOT in the DB `organizers` allow-list. This is a UX
 * courtesy only — the real control is the `matches`/admin-scoped RLS write policies (see
 * supabase/migrations/20260803010000_organizer_gate.sql), which would reject a write from this
 * user regardless of what the UI shows.
 */
export function AdminDenied({ email }: IAdminDeniedProps) {
  const { signOut } = useRefereeAuth();

  return (
    <Card className="max-w-[420px] mx-auto my-[6vh] rounded-[24px] p-9 text-center gap-0">
      <CardContent className="p-0">
        <div className="w-12 h-12 mx-auto rounded-full bg-destructive flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-background" />
        </div>
        <h2 className="mt-5 font-[family-name:var(--font-bricolage)] text-[26px] font-black tracking-[-.03em]">
          Chưa được cấp quyền
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-text-muted">
          Tài khoản {email ?? "này"} chưa nằm trong danh sách quản trị viên được cấp quyền. Liên hệ
          ban tổ chức nếu bạn cần quyền truy cập khu vực quản trị.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={() => {
            void signOut();
          }}
        >
          <LogOut />
          Đăng xuất
        </Button>
      </CardContent>
    </Card>
  );
}
