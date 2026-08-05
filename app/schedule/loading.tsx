import { Skeleton } from "@/components/Skeleton";

/**
 * Loading skeleton for the schedule page.
 * Shows header, legend, and a wide board placeholder matching the Swiss standings layout.
 */
export default function ScheduleLoading() {
  return (
    <div className="mx-auto max-w-[1240px] px-5 pt-[34px] pb-[60px]">
      {/* Header */}
      <Skeleton width="240px" height="44px" borderRadius="8px" />
      <Skeleton width="640px" height="48px" borderRadius="8px" style={{ marginTop: 10, maxWidth: "100%" }} />

      {/* Legend */}
      <div className="mt-[18px] flex flex-wrap gap-2.5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="180px" height="36px" borderRadius="999px" />
        ))}
      </div>

      {/* Board skeleton */}
      <div className="mt-6">
        {/* Tabs/section header */}
        <Skeleton width="320px" height="40px" borderRadius="8px" style={{ marginBottom: 20 }} />

        {/* Wide board with row placeholders */}
        <div className="rounded-[14px] border border-border bg-card p-5">
          {/* Board column headers */}
          <div className="mb-4 grid grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} width="100%" height="24px" borderRadius="4px" />
            ))}
          </div>

          {/* Board rows (standings) */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="mb-3 grid grid-cols-6 gap-3">
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
