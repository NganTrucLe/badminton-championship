"use client";

import { useRefereeAuth } from "@/contexts/RefereeAuthContext";

interface IRefereeDeniedPanelProps {
  email: string | null;
}

/**
 * Shown for a signed-in user whose email is NOT in the DB `organizers` allow-list. This is a UX
 * courtesy only — the real control is the `matches` RLS write policy (see
 * supabase/migrations/20260803010000_organizer_gate.sql), which would reject a write from this
 * user regardless of what the UI shows.
 */
export function RefereeDeniedPanel({ email }: IRefereeDeniedPanelProps) {
  const { signOut } = useRefereeAuth();

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "6vh auto",
        background: "#FFFDF7",
        border: "1px solid rgba(10,31,26,.12)",
        borderRadius: 24,
        padding: 36,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          margin: "0 auto",
          borderRadius: "50%",
          background: "#FF5A47",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#F4F1E6" }} />
      </div>
      <h2
        style={{
          margin: "20px 0 0",
          fontFamily: "var(--font-bricolage), Archivo, sans-serif",
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: "-.03em",
        }}
      >
        Chưa được cấp quyền
      </h2>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5B7A72" }}>
        Tài khoản {email ?? "này"} chưa nằm trong danh sách trọng tài được cấp quyền. Liên hệ ban tổ
        chức nếu bạn cần quyền cập nhật tỉ số.
      </p>
      <button
        type="button"
        onClick={() => {
          void signOut();
        }}
        style={{
          marginTop: 24,
          width: "100%",
          border: "1px solid rgba(10,31,26,.2)",
          background: "transparent",
          padding: 14,
          borderRadius: 12,
          cursor: "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: "#3C5A53",
        }}
      >
        Đăng xuất
      </button>
    </div>
  );
}
