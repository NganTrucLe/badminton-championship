import { Skeleton } from "@/components/Skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton placeholder for HomeLiveSection.
 * Matches the shape and dimensions of the live match card (dark) and recent results card (light).
 * No layout shift — same border-radius, padding, and grid footprint as the real component.
 */
export function HomeLiveSkeleton() {
  return (
    <>
      {/* Dark live match card skeleton */}
      <Card className="col-span-1 gap-0 overflow-hidden rounded-[22px] border-none bg-[var(--color-dark)] p-[26px] text-cream">
        {/* Header with label + info */}
        <div className="flex items-center gap-[9px]">
          <div className="h-2 w-2 flex-none rounded-full bg-white/15" />
          <Skeleton width="140px" height="13px" borderRadius="4px" style={{ background: "rgba(255,255,255,.1)", border: "none" }} />
          <Skeleton
            width="80px"
            height="13px"
            borderRadius="4px"
            style={{ background: "rgba(255,255,255,.1)", border: "none", marginLeft: "auto" }}
          />
        </div>

        {/* Score section */}
        <div className="mt-[22px] grid grid-cols-[1fr_auto_1fr] items-center gap-[14px]">
          <div>
            <Skeleton
              width="100px"
              height="12px"
              borderRadius="4px"
              style={{ background: "rgba(255,255,255,.1)", border: "none", marginBottom: "8px" }}
            />
            <Skeleton
              width="140px"
              height="18px"
              borderRadius="4px"
              style={{ background: "rgba(255,255,255,.1)", border: "none", marginTop: "5px" }}
            />
          </div>
          <Skeleton width="80px" height="48px" borderRadius="4px" style={{ background: "rgba(255,255,255,.1)", border: "none" }} />
          <div className="text-right">
            <Skeleton
              width="100px"
              height="12px"
              borderRadius="4px"
              style={{ background: "rgba(255,255,255,.1)", border: "none", marginBottom: "8px", marginLeft: "auto" }}
            />
            <Skeleton
              width="140px"
              height="18px"
              borderRadius="4px"
              style={{ background: "rgba(255,255,255,.1)", border: "none", marginTop: "5px", marginLeft: "auto" }}
            />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-[22px] h-[5px] overflow-hidden rounded-full bg-white/12">
          <div className="h-full w-[45%] rounded-full bg-white/8" />
        </div>

        {/* Footer text */}
        <Skeleton
          width="160px"
          height="11px"
          borderRadius="4px"
          style={{ background: "rgba(255,255,255,.1)", border: "none", marginTop: "10px" }}
        />
      </Card>

      {/* Light recent results card skeleton */}
      <Card className="gap-0 rounded-[22px] border-[rgba(10,31,26,.12)] bg-cream p-[26px]">
        {/* Header */}
        <Skeleton width="140px" height="12px" borderRadius="4px" />

        {/* Results list placeholders */}
        <div className="mt-4 flex flex-col gap-0.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-[rgba(10,31,26,.08)] py-[11px]">
              <Skeleton width="26px" height="14px" borderRadius="4px" style={{ flex: "none" }} />
              <Skeleton width="120px" height="14px" borderRadius="4px" style={{ flex: 1, minWidth: 0 }} />
              <Skeleton width="40px" height="14px" borderRadius="4px" style={{ flex: "none" }} />
              <Skeleton width="120px" height="14px" borderRadius="4px" style={{ flex: 1, minWidth: 0 }} />
            </div>
          ))}
        </div>

        {/* Link skeleton */}
        <Skeleton width="180px" height="13px" borderRadius="4px" style={{ marginTop: "16px" }} />
      </Card>
    </>
  );
}
