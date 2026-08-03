"use client";

import { useRefereeAuth } from "@/contexts/RefereeAuthContext";

/** Shown when there is no signed-in session at all. */
export function RefereeSignedOutPanel() {
  const { signInWithGoogle } = useRefereeAuth();

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
          background: "#0B5D4E",
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
        Khu vực trọng tài
      </h2>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5B7A72" }}>
        Chỉ tài khoản được cấp quyền mới cập nhật được tỉ số. Đăng nhập bằng Google của bạn.
      </p>
      <button
        type="button"
        onClick={() => {
          void signInWithGoogle("/referee");
        }}
        style={{
          marginTop: 24,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          border: "1px solid rgba(10,31,26,.2)",
          background: "#fff",
          padding: 14,
          borderRadius: 12,
          cursor: "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
          fontSize: 15,
          fontWeight: 700,
          color: "#0A1F1A",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "conic-gradient(#EA4335 0 25%,#FBBC05 0 50%,#34A853 0 75%,#4285F4 0)",
          }}
        />
        Đăng nhập với Google
      </button>
    </div>
  );
}
