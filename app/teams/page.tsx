import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TEAMS, TIER, type TTier } from "@/lib/tournament/data";

const TIER_ORDER: TTier[] = [1, 2, 3, 4];

export default function TeamsPage() {
  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 20px 60px" }}>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-bricolage), Archivo, sans-serif",
          fontSize: "clamp(30px,4.6vw,52px)",
          fontWeight: 900,
          letterSpacing: "-.035em",
        }}
      >
        8 cặp đôi
      </h2>
      <p style={{ margin: "10px 0 0", maxWidth: 560, fontSize: 15, lineHeight: 1.6, color: "#3C5A53" }}>
        16 tay vợt được xếp vào 4 bậc trình. Luật ghép cặp: <strong>Bậc 1 + Bậc 4</strong> và{" "}
        <strong>Bậc 2 + Bậc 3</strong> — để mọi cặp có sức mạnh tương đương nhau.
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {TIER_ORDER.map((n) => (
          <div
            key={n}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#FFFDF7",
              border: "1px solid rgba(10,31,26,.12)",
              borderRadius: 999,
              padding: "7px 14px 7px 8px",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: TIER[n].color,
                color: TIER[n].fg,
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {n}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#3C5A53" }}>{TIER[n].label}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
          gap: 16,
        }}
      >
        {TEAMS.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#FFFDF7",
              border: "1px solid rgba(10,31,26,.12)",
              borderRadius: 22,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  color: "#8AA39C",
                }}
              >
                ĐỘI {t.letter}
              </div>
            </div>
            <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900, letterSpacing: "-.02em" }}>{t.name}</div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {t.players.map((p) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <PlayerAvatar player={p} size={64} initials="double" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-jetbrains), monospace",
                        color: "#8AA39C",
                        marginTop: 2,
                      }}
                    >
                      {TIER[p.tier].label}
                    </div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      width: 26,
                      height: 26,
                      flex: "none",
                      borderRadius: "50%",
                      background: TIER[p.tier].color,
                      color: TIER[p.tier].fg,
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {p.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
