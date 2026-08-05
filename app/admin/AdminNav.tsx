"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gavel, LayoutDashboard, Users, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/referee", label: "Trọng tài", icon: Gavel },
  { href: "/admin/players", label: "Vận động viên", icon: Users },
  { href: "/admin/pairs", label: "Cặp đấu", icon: UsersRound },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1">
      {ADMIN_NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold font-[family-name:var(--font-archivo)]",
              active ? "bg-primary text-primary-foreground" : "text-text-soft bg-[rgba(11,93,78,0.07)]",
            )}
          >
            <Icon size={15} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
