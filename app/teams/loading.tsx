import { Skeleton } from "@/components/Skeleton";
import { Card } from "@/components/ui/card";

/**
 * Loading skeleton for the teams page.
 * Shows header, tier legend, and a grid of team card placeholders.
 */
export default function TeamsLoading() {
  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 20px 60px" }}>
      {/* Header */}
      <Skeleton width="200px" height="44px" borderRadius="8px" />
      <Skeleton width="560px" height="48px" borderRadius="8px" style={{ marginTop: 10, maxWidth: "100%" }} />

      {/* Tier legend */}
      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width="140px" height="36px" borderRadius="999px" />
        ))}
      </div>

      {/* Team cards grid */}
      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
          gap: 16,
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="flex flex-col gap-4 rounded-[22px] border-border bg-card p-5">
            {/* Team header */}
            <div>
              <Skeleton width="80px" height="16px" borderRadius="4px" />
              <Skeleton width="140px" height="24px" borderRadius="8px" style={{ marginTop: 8 }} />
            </div>

            {/* Player rows */}
            {[1, 2].map((j) => (
              <div key={j} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Skeleton width="64px" height="64px" borderRadius="50%" flex="none" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Skeleton width="100%" height="16px" borderRadius="4px" />
                  <Skeleton width="80px" height="12px" borderRadius="4px" style={{ marginTop: 6 }} />
                </div>
                <Skeleton width="26px" height="26px" borderRadius="50%" flex="none" />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
