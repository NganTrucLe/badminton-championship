"use client";

import { useEffect, useState } from "react";
import { useMatches } from "@/contexts/MatchesContext";
import { computeLiveMatch, computeRecentResults } from "@/lib/tournament/standings";

const EVENT_START = "2026-08-15T09:00:00+07:00";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function useCountdown(target: string) {
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

export default function HomePage() {
  const { matches } = useMatches();
  const countdown = useCountdown(EVENT_START);
  const live = computeLiveMatch(matches);
  const recent = computeRecentResults(matches);

  return (
    <div>
      {/* Hero */}
      <div style={{ maxWidth: 1240, margin: "22px auto 0", padding: "0 20px" }}>
        <div
          style={{
            position: "relative",
            borderRadius: 26,
            overflow: "hidden",
            background: "#0B5D4E",
            padding: "clamp(30px,5vw,64px)",
            minHeight: "clamp(430px,60vw,560px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "26%",
                height: 2,
                background: "rgba(255,255,255,.5)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: "14%",
                height: 2,
                background: "rgba(255,255,255,.32)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "50%",
                width: 2,
                background: "rgba(255,255,255,.28)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "-14%",
                right: "-14%",
                top: "20%",
                bottom: "-40%",
                border: "2px solid rgba(255,255,255,.22)",
                borderRadius: "50%",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              right: -70,
              top: -70,
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%,rgba(242,181,68,.5),transparent 62%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                background: "rgba(255,255,255,.13)",
                border: "1px solid rgba(255,255,255,.24)",
                padding: "7px 14px",
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#F2B544",
                  animation: "livePulse 1.6s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  color: "#DCEDE7",
                }}
              >
                MÙA GIẢI 2026 · 8 CẶP ĐÔI
              </span>
            </div>
            <h1
              style={{
                margin: "20px 0 0",
                fontFamily: "var(--font-bricolage), Archivo, sans-serif",
                fontSize: "clamp(36px,7vw,84px)",
                lineHeight: 0.9,
                fontWeight: 900,
                letterSpacing: "-.04em",
                color: "#FFFDF7",
              }}
            >
              GIẢI CẦU
              <br />
              LÔNG CLB
              <span style={{ color: "#F2B544" }}>.</span>
            </h1>
            <p
              style={{
                margin: "20px 0 0",
                maxWidth: 440,
                fontSize: "clamp(15px,1.6vw,18px)",
                lineHeight: 1.55,
                color: "#B9D6CD",
              }}
            >
              16 tay vợt, 8 đội, một buổi sáng. Thể thức Swiss-system (Bo1): thắng đủ 3 trận vào
              playoffs, thua đủ 3 trận dừng bước. Bạn bè trước, ăn thua sau — nhưng vẫn phải
              thắng.
            </p>
          </div>

          <div
            style={{
              position: "relative",
              marginTop: 38,
              display: "flex",
              gap: 34,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 10,
                  letterSpacing: ".16em",
                  color: "#8FBCB0",
                  marginBottom: 10,
                }}
              >
                TRẬN ĐẤU SẼ BẮT ĐẦU SAU
              </div>
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
            </div>
            <div style={{ borderLeft: "1px solid rgba(255,255,255,.2)", paddingLeft: 26 }}>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 10,
                  letterSpacing: ".16em",
                  color: "#8FBCB0",
                  marginBottom: 8,
                }}
              >
                THỜI GIAN
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#FFFDF7" }}>09:00 – 12:00</div>
              <div style={{ fontSize: 14, color: "#B9D6CD", marginTop: 2 }}>Thứ Bảy, 15 tháng 8</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    flex: "none",
                    borderRadius: "50%",
                    border: "2px solid #F2B544",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: 4,
                      height: 4,
                      background: "#F2B544",
                      borderRadius: "50%",
                      transform: "translate(-50%,-50%)",
                    }}
                  />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#DCEDE7" }}>
                  Sân Gia Tưởng, Tân Bình
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live / recent / location cards */}
      <div
        style={{
          maxWidth: 1240,
          margin: "16px auto 0",
          padding: "0 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 16,
        }}
      >
        {live && (
          <div
            style={{
              gridColumn: "span 1",
              background: "#0A1F1A",
              borderRadius: 22,
              padding: 26,
              color: "#FFFDF7",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#FF5A47",
                  animation: "livePulse 1.3s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  letterSpacing: ".18em",
                  color: "#FF8C7D",
                }}
              >
                ĐANG THI ĐẤU
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  color: "#6E8A83",
                }}
              >
                {live.round} · SÂN {live.court}
              </span>
            </div>
            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", color: "#8FBCB0" }}>
                  {live.aName}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 5, lineHeight: 1.3 }}>
                  {live.aPlayers}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontWeight: 700,
                  fontSize: "clamp(38px,6vw,54px)",
                  letterSpacing: "-.03em",
                  whiteSpace: "nowrap",
                }}
              >
                {live.aScore}
                <span style={{ color: "#496660", margin: "0 6px" }}>:</span>
                {live.bScore}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", color: "#8FBCB0" }}>
                  {live.bName}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 5, lineHeight: 1.3 }}>
                  {live.bPlayers}
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 22,
                height: 5,
                borderRadius: 999,
                background: "rgba(255,255,255,.12)",
                overflow: "hidden",
              }}
            >
              <div style={{ height: "100%", background: "#F2B544", borderRadius: 999, width: live.pct }} />
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 10,
                color: "#6E8A83",
              }}
            >
              CHẠM 21 · CÁCH BIỆT 2 ĐIỂM
            </div>
          </div>
        )}

        <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 26 }}>
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10,
              letterSpacing: ".16em",
              color: "#5B7A72",
            }}
          >
            KẾT QUẢ GẦN NHẤT
          </div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
            {recent.map((m) => (
              <div
                key={m.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 0",
                  borderBottom: "1px solid rgba(10,31,26,.08)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 10,
                    color: "#8AA39C",
                    width: 26,
                    flex: "none",
                  }}
                >
                  {m.code}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0 }}>{m.aName}</span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 15,
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  {m.score}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0, textAlign: "right", color: "#5B7A72" }}>
                  {m.bName}
                </span>
              </div>
            ))}
            {recent.length === 0 && (
              <div style={{ fontSize: 13, color: "#8AA39C", fontStyle: "italic", padding: "11px 0" }}>
                Chưa có kết quả nào.
              </div>
            )}
          </div>
          <a
            href="/schedule"
            style={{
              marginTop: 16,
              display: "inline-block",
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: "#0B5D4E",
            }}
          >
            Xem toàn bộ lịch đấu →
          </a>
        </div>

        <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 26 }}>
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10,
              letterSpacing: ".16em",
              color: "#5B7A72",
            }}
          >
            ĐỊA ĐIỂM
          </div>
          <div style={{ marginTop: 14, fontSize: 24, fontWeight: 900, letterSpacing: "-.02em" }}>Sân Gia Tưởng</div>
          <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: "#3C5A53" }}>
            33 Trần Văn Quang, Q. Tân Bình,
            <br />
            TP. Hồ Chí Minh 70000
          </div>
          <div
            style={{
              marginTop: 16,
              position: "relative",
              height: 130,
              borderRadius: 14,
              overflow: "hidden",
              background: "#0B5D4E",
            }}
          >
            <div style={{ position: "absolute", inset: 0, opacity: 0.45 }}>
              <div
                style={{
                  position: "absolute",
                  left: "8%",
                  right: "8%",
                  top: "14%",
                  bottom: "14%",
                  border: "2px solid rgba(255,255,255,.55)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "8%",
                  right: "8%",
                  top: "50%",
                  height: 2,
                  background: "rgba(255,255,255,.55)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "14%",
                  bottom: "14%",
                  left: "30%",
                  width: 2,
                  background: "rgba(255,255,255,.35)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "14%",
                  bottom: "14%",
                  right: "30%",
                  width: 2,
                  background: "rgba(255,255,255,.35)",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#F2B544",
                boxShadow: "0 0 0 8px rgba(242,181,68,.25)",
              }}
            />
          </div>
          <a
            href="https://maps.app.goo.gl/mM8kAaS4AYuqpPJ28"
            target="_blank"
            rel="noopener"
            style={{
              marginTop: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#0B5D4E",
              color: "#FFFDF7",
              padding: "11px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Mở Google Maps →
          </a>
        </div>
      </div>

      {/* Rewards podium */}
      <div style={{ maxWidth: 1240, margin: "16px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-bricolage), Archivo, sans-serif",
              fontSize: "clamp(26px,3.4vw,38px)",
              fontWeight: 900,
              letterSpacing: "-.03em",
            }}
          >
            Phần thưởng
          </h2>
          <span
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 11,
              color: "#8AA39C",
            }}
          >
            TOP 3 · CHI TIẾT SẼ CÔNG BỐ TRƯỚC NGÀY THI ĐẤU
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "20px 0 8px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 220 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: "#C9D6D2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 900,
                color: "#08241E",
                boxShadow: "0 6px 0 rgba(10,31,26,.18)",
              }}
            >
              🥈
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, textAlign: "center" }}>
              Huy chương bạc + phần thưởng
            </div>
            <div
              style={{
                background: "#FFFDF7",
                border: "1px solid rgba(10,31,26,.14)",
                borderRadius: "20px 20px 10px 10px",
                width: "100%",
                height: 150,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  letterSpacing: ".18em",
                  color: "#5B7A72",
                }}
              >
                HẠNG NHÌ
              </div>
              <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-.05em", color: "#0B5D4E" }}>02</div>
              <div style={{ fontSize: 13, color: "#8AA39C" }}>Sẽ công bố 🎉</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 240 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "#F2B544",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                fontWeight: 900,
                color: "#08241E",
                boxShadow: "0 8px 0 rgba(10,31,26,.2)",
              }}
            >
              🏆
            </div>
            <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.3, textAlign: "center" }}>
              Cúp vô địch + phần thưởng chính
            </div>
            <div
              style={{
                background: "#F2B544",
                borderRadius: "24px 24px 10px 10px",
                width: "100%",
                height: 200,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#08241E",
              }}
            >
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, letterSpacing: ".18em" }}>
                HẠNG NHẤT
              </div>
              <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-.05em" }}>01</div>
              <div style={{ fontSize: 14, opacity: 0.75 }}>Sẽ công bố 🥳</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 220 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: "#E0A672",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 900,
                color: "#08241E",
                boxShadow: "0 6px 0 rgba(10,31,26,.18)",
              }}
            >
              🥉
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, textAlign: "center" }}>
              Huy chương đồng + phần thưởng
            </div>
            <div
              style={{
                background: "#FFFDF7",
                border: "1px solid rgba(10,31,26,.14)",
                borderRadius: "20px 20px 10px 10px",
                width: "100%",
                height: 130,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  letterSpacing: ".18em",
                  color: "#5B7A72",
                }}
              >
                HẠNG BA
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-.05em", color: "#0B5D4E" }}>03</div>
              <div style={{ fontSize: 13, color: "#8AA39C" }}>Sẽ công bố 🎊</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
