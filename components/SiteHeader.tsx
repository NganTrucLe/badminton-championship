"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRefereeAuth } from "@/contexts/RefereeAuthContext";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/teams", label: "Các cặp" },
  { href: "/schedule", label: "Lịch & Bảng đấu" },
  { href: "/referee", label: "Trọng tài" },
  { href: "/rules", label: "Quy tắc" },
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Best-effort display name from Supabase's Google OAuth user metadata, falling back to email. */
function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim().length > 0) return fullName;
  return user.email ?? "Trọng tài";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user, signInWithGoogle } = useRefereeAuth();

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(244,241,230,.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(10,31,26,.12)",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto", color: "inherit" }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#0B5D4E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#F4F1E6" }} />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-.02em", color: "#0A1F1A" }}>
              GIẢI CẦU LÔNG CLB
            </div>
            <div
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 10,
                letterSpacing: ".14em",
                color: "#5B7A72",
                marginTop: 3,
              }}
            >
              15.08 · SÂN GIA TƯỞNG
            </div>
          </div>
        </Link>

        <nav style={{ display: "flex", gap: 2, background: "rgba(11,93,78,.07)", padding: 4, borderRadius: 999 }}>
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-archivo), sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "8px 15px",
                  borderRadius: 999,
                  background: "transparent",
                  position: "relative",
                }}
              >
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#0B5D4E",
                      borderRadius: 999,
                    }}
                  />
                )}
                <span style={{ position: "relative", color: active ? "#FFFDF7" : "#3C5A53" }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {user ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "5px 12px 5px 5px",
              borderRadius: 999,
              background: "#0B5D4E",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#F2B544",
                color: "#08241E",
                fontSize: 11,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initialsOf(displayName(user))}
            </div>
            <span style={{ color: "#EAF3F0", fontSize: 12, fontWeight: 600 }}>{displayName(user)}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              void signInWithGoogle("/referee");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid rgba(10,31,26,.2)",
              background: "#FFFDF7",
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: "#0A1F1A",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "conic-gradient(#EA4335 0 25%,#FBBC05 0 50%,#34A853 0 75%,#4285F4 0)",
              }}
            />
            Đăng nhập Google
          </button>
        )}
      </div>
    </div>
  );
}
