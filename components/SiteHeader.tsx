"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRefereeAuth } from "@/contexts/RefereeAuthContext";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GoogleIcon } from "@/components/brand/GoogleIcon";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/teams", label: "Các cặp" },
  { href: "/schedule", label: "Lịch & Bảng đấu" },
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

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="relative rounded-full px-[15px] py-2 font-[family-name:var(--font-archivo)] text-[13px] font-bold"
    >
      {active && <span className="absolute inset-0 rounded-full bg-primary" />}
      <span className={cn("relative", active ? "text-primary-foreground" : "text-text-soft")}>{label}</span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user, signInWithGoogle, signOut } = useRefereeAuth();
  const [isOrg, setIsOrg] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const check = user
      ? createBrowserSupabaseClient()
          .rpc("is_organizer")
          .then(({ data }) => data === true)
      : Promise.resolve(false);
    check.then((result) => {
      if (active) setIsOrg(result);
    });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-5 px-5 py-3.5">
        <Link href="/" className="mr-auto flex items-center gap-2.5 text-inherit">
          <div className="flex size-[30px] flex-none items-center justify-center rounded-full bg-primary">
            <div className="size-[11px] rounded-full bg-background" />
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-black tracking-[-0.02em] text-foreground">GIẢI CẦU LÔNG CLB</div>
            <div className="mt-[3px] font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.14em] text-text-soft">
              15.08 · SÂN GIA TƯỞNG
            </div>
          </div>
        </Link>

        <nav className="flex gap-0.5 rounded-full bg-primary/[.07] p-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={isActivePath(pathname, item.href)} />
          ))}
          {isOrg && <NavLink href="/admin" label="Quản trị" active={pathname.startsWith("/admin")} />}
        </nav>

        {user ? (
          <div className="relative" onMouseEnter={() => setMenuOpen(true)} onMouseLeave={() => setMenuOpen(false)}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-[9px] rounded-full bg-primary py-[5px] pr-3 pl-[5px]"
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-secondary text-[11px] font-black text-secondary-foreground">
                  {initialsOf(displayName(user))}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-primary-foreground">{displayName(user)}</span>
            </button>
            {menuOpen && (
              <div className="absolute top-[calc(100%+6px)] right-0 z-[60] min-w-[160px] rounded-xl border border-border bg-background p-1.5 shadow-[0_8px_24px_rgba(10,31,26,.14)]">
                <button
                  type="button"
                  onClick={() => {
                    void signOut();
                  }}
                  className="w-full rounded-lg px-3 py-[9px] text-left font-[family-name:var(--font-archivo)] text-[13px] font-bold text-destructive"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="rounded-full font-[family-name:var(--font-archivo)] text-xs font-bold"
            onClick={() => {
              void signInWithGoogle("/admin/referee");
            }}
          >
            <GoogleIcon size={14} />
            Đăng nhập Google
          </Button>
        )}
      </div>
    </div>
  );
}
