import { Skeleton } from "@/components/Skeleton";
import { Card } from "@/components/ui/card";

/**
 * Loading skeleton for the teams page.
 * Shows header, tier legend, and a grid of team card placeholders.
 */
export default function TeamsLoading() {
  return (
    <div className="max-w-[1240px] mx-auto px-5 pt-[34px] pb-[60px]">
      {/* Header */}
      <Skeleton width="200px" height="44px" borderRadius="8px" />
      <Skeleton width="560px" height="48px" borderRadius="8px" style={{ marginTop: 10, maxWidth: "100%" }} />

      {/* Tier legend */}
      <div className="mt-5 flex gap-2.5 flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width="140px" height="36px" borderRadius="999px" />
        ))}
      </div>

      {/* Team cards grid */}
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="flex flex-col gap-4 rounded-[22px] border-border bg-card p-5">
            {/* Team header */}
            <div>
              <Skeleton width="80px" height="16px" borderRadius="4px" />
              <Skeleton width="140px" height="24px" borderRadius="8px" style={{ marginTop: 8 }} />
            </div>

            {/* Player rows */}
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3">
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
