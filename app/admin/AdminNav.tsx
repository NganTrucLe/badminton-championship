"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/referee", label: "Trọng tài" },
  { href: "/admin/players", label: "Vận động viên" },
  { href: "/admin/pairs", label: "Cặp đấu" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 24 }}>
      {ADMIN_NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              color: active ? "#FFFDF7" : "#3C5A53",
              background: active ? "#0B5D4E" : "rgba(11,93,78,.07)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
