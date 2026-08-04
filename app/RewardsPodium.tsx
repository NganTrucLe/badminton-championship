import { getTournament } from "@/lib/supabase/tournament";
import type { IReward } from "@/lib/tournament/reward";

// Reads the podium copy (title/detail per place) from the tournament config in Supabase so
// organizers can update reward text without a code change. Styling/markup is unchanged from the
// previous hardcoded block — only the text now comes from `rewards`.
export async function RewardsPodium() {
  const { rewards } = await getTournament();
  const byPlace = (n: number): IReward => rewards.find((r) => r.place === n) ?? rewards[0];
  const first = byPlace(1);
  const second = byPlace(2);
  const third = byPlace(3);

  return (
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
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, textAlign: "center" }}>{second.title}</div>
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
          <div style={{ fontSize: 13, color: "#8AA39C" }}>{second.detail}</div>
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
        <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.3, textAlign: "center" }}>{first.title}</div>
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
          <div style={{ fontSize: 14, opacity: 0.75 }}>{first.detail}</div>
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
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, textAlign: "center" }}>{third.title}</div>
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
          <div style={{ fontSize: 13, color: "#8AA39C" }}>{third.detail}</div>
        </div>
      </div>
    </div>
  );
}
