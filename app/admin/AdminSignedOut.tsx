"use client";

import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/brand/GoogleIcon";

/** Shown when there is no signed-in session at all. */
export function AdminSignedOut() {
  const { signInWithGoogle } = useRefereeAuth();

  return (
    <Card className="max-w-[420px] mx-auto my-[6vh] rounded-[24px] p-9 text-center gap-0">
      <CardContent className="p-0">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-background" />
        </div>
        <h2 className="mt-5 font-[family-name:var(--font-bricolage)] text-[26px] font-black tracking-[-.03em]">
          Khu vực quản trị
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-text-muted">
          Chỉ tài khoản được cấp quyền mới truy cập được khu vực quản trị. Đăng nhập bằng Google của
          bạn.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={() => {
            void signInWithGoogle("/admin");
          }}
        >
          <GoogleIcon size={18} />
          Đăng nhập với Google
        </Button>
      </CardContent>
    </Card>
  );
}
