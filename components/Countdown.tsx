"use client";

import { useEffect, useState } from "react";

interface ICountdownUnit {
  v: string;
  l: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function useCountdown(target: string): ICountdownUnit[] {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mounted]);

  if (!mounted) {
    return [
      { v: "00", l: "NGÀY" },
      { v: "00", l: "GIỜ" },
      { v: "00", l: "PHÚT" },
      { v: "00", l: "GIÂY" },
    ];
  }

  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / 864e5);
  const hrs = Math.floor(diff / 36e5) % 24;
  const mins = Math.floor(diff / 6e4) % 60;
  const secs = Math.floor(diff / 1e3) % 60;

  return [
    { v: pad2(days), l: "NGÀY" },
    { v: pad2(hrs), l: "GIỜ" },
    { v: pad2(mins), l: "PHÚT" },
    { v: pad2(secs), l: "GIÂY" },
  ];
}

/**
 * Client island for the hero countdown — kept as the only interactive/client piece of the
 * (otherwise server-rendered) home page. The mounted-gate avoids the SSR/CSR hydration mismatch
 * that a `Date.now()`-based countdown would otherwise cause.
 */
export function Countdown({ target }: { target: string }) {
  const countdown = useCountdown(target);

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {countdown.map((c) => (
        <div
          key={c.l}
          style={{
            background: "rgba(255,253,247,.1)",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 12,
            padding: "10px 14px",
            minWidth: 72,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontWeight: 700,
              fontSize: "clamp(24px,3.4vw,34px)",
              color: "#FFFDF7",
              lineHeight: 1,
            }}
          >
            {c.v}
          </div>
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 9,
              letterSpacing: ".14em",
              color: "#8FBCB0",
              marginTop: 6,
            }}
          >
            {c.l}
          </div>
        </div>
      ))}
    </div>
  );
}
