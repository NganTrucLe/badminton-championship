import { Skeleton } from "@/components/Skeleton";

/**
 * Loading skeleton for the schedule page.
 * Shows header, legend, and a wide board placeholder matching the Swiss standings layout.
 */
export default function ScheduleLoading() {
  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 20px 60px" }}>
      {/* Header */}
      <Skeleton width="240px" height="44px" borderRadius="8px" />
      <Skeleton width="640px" height="48px" borderRadius="8px" style={{ marginTop: 10, maxWidth: "100%" }} />

      {/* Legend */}
      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="180px" height="36px" borderRadius="999px" />
        ))}
      </div>

      {/* Board skeleton */}
      <div style={{ marginTop: 24 }}>
        {/* Tabs/section header */}
        <Skeleton width="320px" height="40px" borderRadius="8px" style={{ marginBottom: 20 }} />

        {/* Wide board with row placeholders */}
        <div
          style={{
            background: "#FFFDF7",
            border: "1px solid rgba(10,31,26,.12)",
            borderRadius: 14,
            padding: 20,
          }}
        >
          {/* Board column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} width="100%" height="24px" borderRadius="4px" />
            ))}
          </div>

          {/* Board rows (standings) */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <Skeleton key={j} width="100%" height="32px" borderRadius="8px" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
