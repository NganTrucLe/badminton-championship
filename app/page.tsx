import { Suspense } from "react";
import { Countdown } from "@/components/Countdown";
import { HomeLiveSection } from "@/app/HomeLiveSection";
import { HomeLiveSkeleton } from "@/app/HomeLiveSkeleton";
import { RewardsPodium } from "@/app/RewardsPodium";
import { getMatches, getPairIdToTeamId } from "@/lib/supabase/tournament";

const EVENT_START = "2026-08-15T09:00:00+07:00";

// Read fresh from Supabase on every request for a correct first paint — the live match card and
// recent results then hydrate into a client island (HomeLiveSection) that stays live via
// Supabase Realtime, so scores update without a reload after the initial SSR.
export const dynamic = "force-dynamic";

async function HomeLiveData() {
  const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);
  return <HomeLiveSection initialMatches={matches} pairIdToTeamId={pairIdToTeamId} />;
}

export default function HomePage() {
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
              <Countdown target={EVENT_START} />
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
        <Suspense fallback={<HomeLiveSkeleton />}>
          <HomeLiveData />
        </Suspense>

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
        <Suspense fallback={<div style={{ height: 260 }} />}>
          <RewardsPodium />
        </Suspense>
      </div>
    </div>
  );
}
